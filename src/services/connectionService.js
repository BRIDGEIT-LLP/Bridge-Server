'use strict';

const { sequelize } = require('../models');
const { errorLogger } = require('../configs/logger');
const connectionRepository = require('../repositories/connectionRepository');
const connectionStatusLogRepository = require('../repositories/connectionStatusLogRepository');
const userRepository = require('../repositories/userRepository');
const userLimitConfigRepository = require('../repositories/userLimitConfigRepository');
const dealRoomService = require('./dealRoomService');
const adminConfigService = require('./adminConfigService');
const { canConnect } = require('../matching/eligibilityService');
const ServiceResponse = require('../utils/ServiceResponse');
const { CONNECTION_STATUS, CONNECTION_MESSAGES, CONNECTION_VALID_TRANSITIONS, CONNECTION_REQUEST_LIMITS, TRIAL_CONFIG_LOOKUP_KEYS } = require('../utils/constant');

const parseWindowEpoch = (value) => {
    if (value == null || value === '') {
        return null;
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
};

// Rolling 1-month window from an epoch (registration date, or subscription
// start_date after the user buys a plan — that is what resets used/remaining).
const getConnectionBillingWindow_internal = (epochDate) => {
    const today = new Date();
    let monthsElapsed = (today.getFullYear() - epochDate.getFullYear()) * 12
        + (today.getMonth() - epochDate.getMonth());
    if (today.getDate() < epochDate.getDate()) {
        monthsElapsed -= 1;
    }
    const windowStart = new Date(epochDate);
    windowStart.setMonth(windowStart.getMonth() + monthsElapsed);
    const windowEnd = new Date(windowStart);
    windowEnd.setMonth(windowEnd.getMonth() + 1);
    return { windowStart, windowEnd };
};

const getConnectionBillingWindow = async (userId, subscriptionStartDate = null) => {
    try {
        let epoch = parseWindowEpoch(subscriptionStartDate);
        if (!epoch) {
            const user = await userRepository.getUserById(userId);
            epoch = new Date(user.created_at);
        }
        const { windowStart, windowEnd } = getConnectionBillingWindow_internal(epoch);
        return ServiceResponse.success({ data: { windowStart, windowEnd }, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

const getConnectionRequestsInWindow = async (userId, windowStart, windowEnd) => {
    try {
        const count = await connectionRepository.countRequestsInWindow(userId, windowStart, windowEnd);
        return ServiceResponse.success({ data: { count }, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

// Resolution order: per-user override (UserLimitConfig) → trial/plan default
// (TrialConfigMaster, via adminConfigService — already Redis read-through) →
// hardcoded constant as a last-resort fallback if the config row is missing.
const getConnectionRequestLimit = async (userId, hasActiveSubscription) => {
    const userLimitConfig = await userLimitConfigRepository.findByUserId(userId);
    if (userLimitConfig?.allowed_connections != null && hasActiveSubscription === false) {
        return userLimitConfig.allowed_connections;
    }

    const lookup = hasActiveSubscription
        ? TRIAL_CONFIG_LOOKUP_KEYS.PREMIUM_CONNECTION_LIMIT
        : TRIAL_CONFIG_LOOKUP_KEYS.FREE_CONNECTION_LIMIT;
    const fallback = hasActiveSubscription ? CONNECTION_REQUEST_LIMITS.PREMIUM : CONNECTION_REQUEST_LIMITS.FREE;

    return await adminConfigService.getTrialConfigValue(lookup, fallback);
};

const validateConnectionLimit = async (userId, requestCount, hasActiveSubscription) => {
    const limit = await getConnectionRequestLimit(userId, hasActiveSubscription);
    if (requestCount >= limit) {
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.CONNECTION_LIMIT_REACHED, statusCode: 403 });
    }
    return ServiceResponse.success({ statusCode: 200 });
};

const sendRequest = async ({ requesterUserId, requesterRoleId, requesterCompanyId, requesterRoleCode, recipientUserId, recipientRoleId, recipientCompanyId, personalMessage, bussinessIntent, expectedDealSize, productServiceDetails }) => {
    const transaction = await sequelize.transaction();
    try {
        // 1. Check recipient user exists
        const recipient = await userRepository.getUserById(recipientUserId);
        if (!recipient) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.RECIPIENT_NOT_FOUND, statusCode: 404 });
        }

        // 2. Get recipient's CompanyUserRole to fetch company_id and role_code
        const recipientCompanyUserRole = await connectionRepository.findRecipientCompanyUserRole(recipientUserId, recipientRoleId);
        if (!recipientCompanyUserRole) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.RECIPIENT_ROLE_NOT_FOUND, statusCode: 404 });
        }

        const recipientRoleCode = recipientCompanyUserRole.role?.role_code;
        if (!canConnect(requesterRoleCode, recipientRoleCode)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.INVALID_ROLE_PAIR, statusCode: 400 });
        }

        // 3. Check for an existing blocking connection between this role pair.
        // Declined / Withdrawn / Expired are not blocking — the requester may send again.
        const existing = await connectionRepository.findExistingConnection(requesterUserId, requesterRoleId, recipientUserId, recipientRoleId);
        if (existing) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.ALREADY_EXISTS, statusCode: 409 });
        }

        // Soft-delete prior Declined/Withdrawn/Expired rows so a later decline
        // of this new request does not collide with unique (pair, status).
        await connectionRepository.softDeleteReopenableConnections(
            requesterUserId, requesterRoleId, recipientUserId, recipientRoleId, requesterUserId, { transaction }
        );

        // 4. Create connection
        const connection = await connectionRepository.create({
            requester_user_id: requesterUserId,
            requester_role_id: requesterRoleId,
            requester_company_id: requesterCompanyId,
            recipient_user_id: recipientUserId,
            recipient_role_id: recipientRoleId,
            recipient_company_id: recipientCompanyUserRole.company_id,
            status: CONNECTION_STATUS.PENDING,
            message: personalMessage || null,
            bussiness_intent: bussinessIntent || null,
            expected_deal_size: expectedDealSize || null,
            product_service_details: productServiceDetails || null,
            created_by: requesterUserId
        }, { transaction });

        // 5. Log initial status
        await connectionStatusLogRepository.create({
            connection_id: connection.id,
            status: CONNECTION_STATUS.PENDING,
            changed_by: requesterUserId
        }, { transaction });

        await transaction.commit();
        return ServiceResponse.success({ data: connection, message: CONNECTION_MESSAGES.REQUEST_SENT, statusCode: 201 });

    } catch (error) {
        console.log(error);
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

const changeStatus = async ({ connectionId, status, reason, userId }) => {
    const transaction = await sequelize.transaction();
    try {
        // 1. Fetch connection
        const connection = await connectionRepository.findById(connectionId);
        if (!connection) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        // 2. Validate transition
        const allowedPreviousStatuses = CONNECTION_VALID_TRANSITIONS[status];
        if (!allowedPreviousStatuses.includes(connection.status)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.INVALID_TRANSITION, statusCode: 400 });
        }

        // 3. Validate caller authorization
        const isRequester = connection.requester_user_id === userId;
        const isRecipient = connection.recipient_user_id === userId;

        if (status === CONNECTION_STATUS.WITHDRAWN && !isRequester) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        if ([CONNECTION_STATUS.VIEWED, CONNECTION_STATUS.ACCEPTED, CONNECTION_STATUS.DECLINED, CONNECTION_STATUS.DEFERRED].includes(status) && !isRecipient) {
            await transaction.rollback();
            return ServiceResponse.error({ message: CONNECTION_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        // 4. Update connection status
        const updated = await connectionRepository.updateStatus(connectionId, status, reason, { transaction });

        // 5. Log status change
        await connectionStatusLogRepository.create({
            connection_id: connectionId,
            status,
            changed_by: userId
        }, { transaction });

        let dealRoomResult = null;
        if (status === CONNECTION_STATUS.ACCEPTED) {
            dealRoomResult = await dealRoomService.createDealRoom(connection, { transaction });
            if (!dealRoomResult.success) {
                await transaction.rollback();
                return ServiceResponse.error({ message: dealRoomResult.message, statusCode: dealRoomResult.statusCode });
            }
        }

        let dealRoomId = null;
        if (dealRoomResult) {
            const dealRoom = dealRoomResult.data;
            dealRoomId = dealRoom.id;
        }

        await transaction.commit();
        return ServiceResponse.success({ data: {connection: updated, deal_room_id: dealRoomId}, message: CONNECTION_MESSAGES[`REQUEST_${status.toUpperCase()}`], statusCode: 200 });

    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

const getSentConnections = async (userId, roleId) => {
    try {
        const connections = await connectionRepository.findSentByUser(userId, roleId);
        return ServiceResponse.success({ data: connections, message: CONNECTION_MESSAGES.SENT_FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.SENT_FETCH_FAILED, statusCode: 500 });
    }
};

const getReceivedConnections = async (userId, roleId) => {
    try {
        const connections = await connectionRepository.findReceivedByUser(userId, roleId);
        return ServiceResponse.success({ data: connections, message: CONNECTION_MESSAGES.RECEIVED_FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: CONNECTION_MESSAGES.RECEIVED_FETCH_FAILED, statusCode: 500 });
    }
};

module.exports = { getConnectionBillingWindow, getConnectionRequestsInWindow, getConnectionRequestLimit, validateConnectionLimit, sendRequest, changeStatus, getSentConnections, getReceivedConnections };
