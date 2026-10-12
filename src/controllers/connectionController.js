'use strict';

const { errorLogger } = require('../configs/logger');
const connectionService = require('../services/connectionService');
const subscriptionService = require('../services/subscriptionService');
const HttpResponse = require('../utils/HttpResponse');

const sendConnectionRequest = async (req, res, next) => {
    try {
        const { recipientUserId, recipientRoleId, recipientCompanyId, personalMessage, bussinessIntent, expectedDealSize, productServiceDetails } = req.body;
        const { userId, roleId, companyId, role } = req;

        // 1. Find whether user has an active subscription
        const subscriptionResult = await subscriptionService.findActivePrememiumSubscription(companyId, userId);
        if (!subscriptionResult.success) {
            return HttpResponse.error(res, { message: subscriptionResult.message, statusCode: subscriptionResult.statusCode });
        }

        const userSubscriptions = subscriptionResult.data; // userSubscriptions
        const hasActiveSubscription = userSubscriptions ? true : false;

        // 2. Find the billing window. Active subscription resets the epoch to start_date
        // so requests sent on the free quota no longer count against this window.
        const windowResult = await connectionService.getConnectionBillingWindow(
            userId,
            userSubscriptions?.start_date ?? null
        );
        if (!windowResult.success) {
            return HttpResponse.error(res, { message: windowResult.message, statusCode: windowResult.statusCode });
        }

        // 3. Find all connection requests sent by the user in the billing window
        const { windowStart, windowEnd } = windowResult.data;
        const countResult = await connectionService.getConnectionRequestsInWindow(userId, windowStart, windowEnd);
        if (!countResult.success) {
            return HttpResponse.error(res, { message: countResult.message, statusCode: countResult.statusCode });
        }

        const requestCount = countResult.data.count

        // 4. Validate the limit — return message if exceeded
        const limitResult = await connectionService.validateConnectionLimit(userId, requestCount, hasActiveSubscription);
        if (!limitResult.success) {
            return HttpResponse.error(res, { message: limitResult.message, statusCode: limitResult.statusCode });
        }

        // 5. Send the connection request
        const result = await connectionService.sendRequest({
            requesterUserId: userId,
            requesterRoleId: roleId,
            requesterCompanyId: companyId,
            requesterRoleCode: role,
            recipientUserId,
            recipientRoleId,
            recipientCompanyId,
            personalMessage, 
            bussinessIntent, 
            expectedDealSize, 
            productServiceDetails
        });
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res);
    }
};

const changeConnectionStatus = async (req, res, next) => {
    try {
        const { connectionId, status, reason } = req.body;
        const { userId } = req;

        const result = await connectionService.changeStatus({ connectionId, status, reason, userId });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getSentConnections = async (req, res, next) => {
    try {
        const { userId, roleId } = req;

        const result = await connectionService.getSentConnections(userId, roleId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getReceivedConnections = async (req, res, next) => {
    try {
        const { userId, roleId } = req;

        const result = await connectionService.getReceivedConnections(userId, roleId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

module.exports = { sendConnectionRequest, changeConnectionStatus, getSentConnections, getReceivedConnections };
