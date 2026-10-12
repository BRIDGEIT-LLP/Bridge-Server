'use strict';

const { errorLogger } = require('../configs/logger');
const subscriptionService = require('../services/subscriptionService');
const { SUBSCRIPTION_PLAN_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

/**
 * GET /api/v1/subscriptions/plans
 * Returns all active subscription plans with a "valid till preview" date.
 * Accessible by any authenticated user.
 */
const getPlans = async (req, res, next) => {
    try {
        const result = await subscriptionService.getPlans();

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SUBSCRIPTION_PLAN_MESSAGES.PLANS_FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/subscriptions/select
 * Body: { plan_id: number }
 * Selects the specified plan for the authenticated user.  Any existing active
 * subscription is cancelled first; the new one starts today.
 */
const selectPlan = async (req, res, next) => {
    try {
        const userId = req.userId;
        const companyId = req.companyId;
        const { plan_id } = req.body;

        if (!plan_id || isNaN(parseInt(plan_id, 10)) || parseInt(plan_id, 10) <= 0) {
            return HttpResponse.error(res, {
                message: SUBSCRIPTION_PLAN_MESSAGES.PLAN_ID_REQUIRED,
                statusCode: 400
            });
        }

        const result = await subscriptionService.selectPlan({
            planId: parseInt(plan_id, 10),
            userId,
            companyId
        });

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SUBSCRIPTION_PLAN_MESSAGES.PLAN_SELECT_FAILED,
            statusCode: 500
        });
    }
};

/**
 * GET /api/v1/subscriptions/my
 * Returns the authenticated user's current active subscription with plan details.
 */
const getUserSubscription = async (req, res, next) => {
    try {
        const userId = req.userId;
        const companyId = req.companyId;

        const result = await subscriptionService.getUserSubscription({ userId, companyId });

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SUBSCRIPTION_PLAN_MESSAGES.SUBSCRIPTION_FETCH_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getPlans, selectPlan, getUserSubscription };