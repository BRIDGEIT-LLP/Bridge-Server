'use strict';

const { sequelize } = require('../models');
const { errorLogger } = require('../configs/logger');
const dealRoomRepository = require('../repositories/dealRoomRepository');
const dealRoomArchiveRepository = require('../repositories/dealRoomArchiveRepository');
const dealRoomStageRequestRepository = require('../repositories/dealRoomStageRequestRepository');
const dealRoomStageRequestLogRepository = require('../repositories/dealRoomStageRequestLogRepository');
const dealRoomTermSheetRepository = require('../repositories/dealRoomTermSheetRepository');
const dealRoomB2BConfirmationRepository = require('../repositories/dealRoomB2BConfirmationRepository');
const dealRoomOfferRepository = require('../repositories/dealRoomOfferRepository');
const ServiceResponse = require('../utils/ServiceResponse');
const { DEAL_ROOM_STATUS, DEAL_ROOM_MESSAGES, DEAL_ROOM_STAGES, DEAL_ROOM_STAGE_REQUEST_STATUS, DEAL_ROOM_STAGE_MESSAGES } = require('../utils/constant');

const getDealRooms = async (userId, roleId, { archived = false } = {}) => {
    try {
        const dealRooms = await dealRoomRepository.findAllByUserId(userId, roleId, { archived });
        return ServiceResponse.success({ data: dealRooms, message: DEAL_ROOM_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const archiveDealRoom = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_FOUND, statusCode: 404 });
        }
        if (!isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const existing = await dealRoomArchiveRepository.findByDealRoomAndUser(dealRoomId, userId);
        if (existing) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.ALREADY_ARCHIVED, statusCode: 400 });
        }

        const created = await dealRoomArchiveRepository.archive(dealRoomId, userId);
        return ServiceResponse.success({ data: created, message: DEAL_ROOM_MESSAGES.ARCHIVE_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.ARCHIVE_FAILED, statusCode: 500 });
    }
};

const unarchiveDealRoom = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_FOUND, statusCode: 404 });
        }
        if (!isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const existing = await dealRoomArchiveRepository.findByDealRoomAndUser(dealRoomId, userId);
        if (!existing) {
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_ARCHIVED, statusCode: 400 });
        }

        await dealRoomArchiveRepository.unarchive(dealRoomId, userId);
        return ServiceResponse.success({ data: null, message: DEAL_ROOM_MESSAGES.UNARCHIVE_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.UNARCHIVE_FAILED, statusCode: 500 });
    }
};

const isParticipant = (dealRoom, userId) => {
    return dealRoom.requester_user_id === userId || dealRoom.recipient_user_id === userId;
};

const createDealRoom = async (connection, { transaction } = {}) => {
    try {
        const dealRoom = await dealRoomRepository.create({
            connection_id: connection.id,
            requester_user_id: connection.requester_user_id,
            requester_role_id: connection.requester_role_id,
            requester_company_id: connection.requester_company_id,
            recipient_user_id: connection.recipient_user_id,
            recipient_role_id: connection.recipient_role_id,
            recipient_company_id: connection.recipient_company_id,
            created_by: connection.recipient_user_id
        }, { transaction });

        return ServiceResponse.success({ data: dealRoom, message: DEAL_ROOM_MESSAGES.CREATE_SUCCESS, statusCode: 201 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

const closeDealRoom = async (dealRoomId, { reason, userId }) => {
    const transaction = await sequelize.transaction();
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        if (dealRoom.status === DEAL_ROOM_STATUS.CLOSED) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.ALREADY_CLOSED, statusCode: 400 });
        }

        if (!isParticipant(dealRoom, userId)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const updated = await dealRoomRepository.closeById(dealRoomId, {
            closedReason: reason || null,
            closedBy: userId
        }, { transaction });

        await transaction.commit();
        return ServiceResponse.success({ data: updated, message: DEAL_ROOM_MESSAGES.CLOSE_SUCCESS, statusCode: 200 });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_MESSAGES.CLOSE_FAILED, statusCode: 500 });
    }
};

const requestStageUpdate = async ({ dealRoomId, requestedStage, requestedByUserId, requestedByRoleId }) => {
    const transaction = await sequelize.transaction();
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        if (!isParticipant(dealRoom, requestedByUserId)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        if (dealRoom.status !== DEAL_ROOM_STATUS.ACTIVE) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.DEAL_ROOM_CLOSED, statusCode: 400 });
        }

        if (!Object.values(DEAL_ROOM_STAGES).includes(requestedStage)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.INVALID_STAGE, statusCode: 400 });
        }

        if (requestedStage === dealRoom.stage) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.SAME_STAGE, statusCode: 400 });
        }

        // Don't let the room LEAVE Negotiation while a funding offer is still Pending —
        // offers lock once past Negotiation, so an unresolved one would be stranded with
        // no way to accept/reject/counter it. (No-op for B2B rooms — they have no offers.)
        if (dealRoom.stage === DEAL_ROOM_STAGES.NEGOTIATION && requestedStage !== DEAL_ROOM_STAGES.NEGOTIATION) {
            const pendingOffer = await dealRoomOfferRepository.findPendingByDealRoomId(dealRoomId);
            if (pendingOffer) {
                await transaction.rollback();
                return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.PENDING_OFFER_BLOCKS_TRANSITION, statusCode: 409 });
            }
        }

        const pending = await dealRoomStageRequestRepository.findPendingByDealRoomId(dealRoomId);
        if (pending) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_PENDING_EXISTS, statusCode: 409 });
        }

        const stageRequest = await dealRoomStageRequestRepository.create({
            deal_room_id: dealRoomId,
            requested_by_user_id: requestedByUserId,
            requested_by_role_id: requestedByRoleId,
            current_stage: dealRoom.stage,
            requested_stage: requestedStage,
            status: DEAL_ROOM_STAGE_REQUEST_STATUS.PENDING,
            created_by: requestedByUserId
        }, { transaction });

        // Every request/response is logged here — this is the activity trail for stage changes.
        await dealRoomStageRequestLogRepository.create({
            deal_room_stage_request_id: stageRequest.id,
            status: DEAL_ROOM_STAGE_REQUEST_STATUS.PENDING,
            changed_by: requestedByUserId
        }, { transaction });

        await transaction.commit();
        return ServiceResponse.success({ data: stageRequest, message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_SUCCESS, statusCode: 201 });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

const getPendingStageUpdate = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        if (!isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const pending = await dealRoomStageRequestRepository.findPendingByDealRoomId(dealRoomId);
        return ServiceResponse.success({ data: pending, message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

const respondStageUpdate = async ({ dealRoomId, requestId, decision, respondedByUserId }) => {
    const transaction = await sequelize.transaction();
    try {
        if (![DEAL_ROOM_STAGE_REQUEST_STATUS.ACCEPTED, DEAL_ROOM_STAGE_REQUEST_STATUS.REJECTED].includes(decision)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.INVALID_DECISION, statusCode: 400 });
        }

        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        if (!isParticipant(dealRoom, respondedByUserId)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const stageRequest = await dealRoomStageRequestRepository.findById(requestId);
        if (!stageRequest || stageRequest.deal_room_id !== dealRoomId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_NOT_FOUND, statusCode: 404 });
        }

        if (stageRequest.status !== DEAL_ROOM_STAGE_REQUEST_STATUS.PENDING) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.REQUEST_NOT_PENDING, statusCode: 400 });
        }

        if (stageRequest.requested_by_user_id === respondedByUserId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.CANNOT_RESPOND_OWN_REQUEST, statusCode: 403 });
        }

        // Authoritative check: even if none was pending when the request was created, an
        // offer may have been sent since (the room is still in Negotiation). Block the
        // accept so the room never advances past Negotiation with a live Pending offer —
        // the stage request stays Pending and can be accepted once the offer is resolved.
        if (decision === DEAL_ROOM_STAGE_REQUEST_STATUS.ACCEPTED
            && dealRoom.stage === DEAL_ROOM_STAGES.NEGOTIATION
            && stageRequest.requested_stage !== DEAL_ROOM_STAGES.NEGOTIATION) {
            const pendingOffer = await dealRoomOfferRepository.findPendingByDealRoomId(dealRoomId);
            if (pendingOffer) {
                await transaction.rollback();
                return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.PENDING_OFFER_BLOCKS_TRANSITION, statusCode: 409 });
            }
        }

        const updatedRequest = await dealRoomStageRequestRepository.respond(requestId, {
            status: decision,
            respondedByUserId
        }, { transaction });

        await dealRoomStageRequestLogRepository.create({
            deal_room_stage_request_id: requestId,
            status: decision,
            changed_by: respondedByUserId
        }, { transaction });

        let updatedDealRoom = dealRoom;
        if (decision === DEAL_ROOM_STAGE_REQUEST_STATUS.ACCEPTED) {
            updatedDealRoom = await dealRoomRepository.updateStage(dealRoomId, stageRequest.requested_stage, {
                updatedBy: respondedByUserId,
                transaction
            });

            // B2B term-sheet confirmation: accepting a Negotiation -> Due Diligence move
            // locks in the current term sheet as the agreed/final version (one party
            // requested, the other accepted — that mutual consent IS the confirmation).
            // Scopes naturally to B2B rooms since only they have a term sheet.
            if (stageRequest.current_stage === DEAL_ROOM_STAGES.NEGOTIATION
                && stageRequest.requested_stage === DEAL_ROOM_STAGES.DUE_DILIGENCE) {
                const termSheet = await dealRoomTermSheetRepository.findLatestByDealRoomId(dealRoomId);
                await dealRoomB2BConfirmationRepository.recordConfirmation(dealRoomId, {
                    confirmedTermSheetId: termSheet ? termSheet.id : null,
                    requestedByUserId: stageRequest.requested_by_user_id,
                    acceptedByUserId: respondedByUserId,
                    confirmedAt: new Date()
                }, { transaction });
            }
        }

        await transaction.commit();
        return ServiceResponse.success({
            data: { request: updatedRequest, dealRoom: updatedDealRoom },
            message: DEAL_ROOM_STAGE_MESSAGES.RESPOND_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_STAGE_MESSAGES.RESPOND_FAILED, statusCode: 500 });
    }
};

module.exports = {
    getDealRooms,
    createDealRoom,
    closeDealRoom,
    isParticipant,
    requestStageUpdate,
    respondStageUpdate,
    getPendingStageUpdate,
    archiveDealRoom,
    unarchiveDealRoom
};
