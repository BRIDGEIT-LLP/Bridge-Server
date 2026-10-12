'use strict';

const { addDays, format } = require('date-fns');
const { sequelize } = require('../models');
const subscriptionPlanRepository = require('../repositories/subscriptionPlanRepository');
const subscriptionRepository = require('../repositories/subscriptionRepository');
// Preserved to keep findActivePrememiumSubscription working for connectionController
// and matchingService — the typo in the filename is intentional (matches existing file).
const subscriptoinRepository = require('../repositories/subscriptoinRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { SUBSCRIPTION_PLAN_MESSAGES, SUBSCRIPTION_MESSAGES } = require('../utils/constant');

/**
 * Fetch all active subscription plans.
 * The "valid till" preview date is calculated server-side so the UI just renders
 * what it receives. We return it as an ISO date string (YYYY-MM-DD).
 */
const getPlans = async () => {
    try {
        const plans = await subscriptionPlanRepository.getActivePlans();

        const today = new Date();
        const data = plans.map((plan) => ({
            id: plan.id,
            plan_name: plan.plan_name,
            plan_benefits: plan.plan_benefits,
            validity_days: plan.validity_days,
            // Preview: "if the user subscribes today, valid until …"
            valid_till_preview: format(addDays(today, plan.validity_days), 'dd MMM yyyy')
        }));

        return ServiceResponse.success({
            message: SUBSCRIPTION_PLAN_MESSAGES.PLANS_FETCH_SUCCESS,
            data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SUBSCRIPTION_PLAN_MESSAGES.PLANS_FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Select a plan for the authenticated user.
 * - Validates that the requested plan exists and is active.
 * - Cancels any current active subscription before creating the new one.
 * - Calculates start_date (today) and end_date (today + validity_days) using date-fns.
 * - All writes happen inside a single transaction.
 */
const selectPlan = async ({ planId, userId, companyId }) => {
    const transaction = await sequelize.transaction();
    try {
        const plan = await subscriptionPlanRepository.getPlanById(planId);
        if (!plan) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: SUBSCRIPTION_PLAN_MESSAGES.PLAN_NOT_FOUND,
                statusCode: 404
            });
        }

        // Cancel any currently active subscription for this user+company
        await subscriptionRepository.cancelActiveSubscriptions(userId, companyId, userId, { transaction });

        const startDate = new Date();
        const endDate = addDays(startDate, plan.validity_days);

        const subscription = await subscriptionRepository.createSubscription(
            {
                user_id: userId,
                company_id: companyId,
                plan_id: plan.id,
                start_date: format(startDate, 'dd MMM yyyy'),
                end_date: format(endDate, 'dd MMM yyyy'),
                status: 'active',
                created_by: userId,
                created_at: new Date()
            },
            { transaction }
        );

        await transaction.commit();

        return ServiceResponse.success({
            message: SUBSCRIPTION_PLAN_MESSAGES.PLAN_SELECT_SUCCESS,
            data: {
                subscription_id: subscription.id,
                plan_name: plan.plan_name,
                start_date: subscription.start_date,
                end_date: subscription.end_date,
                status: subscription.status
            },
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SUBSCRIPTION_PLAN_MESSAGES.PLAN_SELECT_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Fetch the currently active subscription (with plan details) for a user+company.
 */
const getUserSubscription = async ({ userId, companyId }) => {
    try {
        const subscription = await subscriptionRepository.getActiveSubscription(userId, companyId);

        if (!subscription) {
            return ServiceResponse.error({
                message: SUBSCRIPTION_PLAN_MESSAGES.SUBSCRIPTION_NOT_FOUND,
                statusCode: 404
            });
        }

        return ServiceResponse.success({
            message: SUBSCRIPTION_PLAN_MESSAGES.SUBSCRIPTION_FETCH_SUCCESS,
            data: {
                subscription_id: subscription.id,
                plan_id: subscription.plan_id,
                plan_name: subscription.plan?.plan_name ?? null,
                plan_benefits: subscription.plan?.plan_benefits ?? [],
                start_date: format(subscription.start_date, 'dd MMM yyyy'),
                end_date: format(subscription.end_date, 'dd MMM yyyy'),
                status: subscription.status
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SUBSCRIPTION_PLAN_MESSAGES.SUBSCRIPTION_FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Preserved from the original subscriptionService — called by:
 *   - src/controllers/connectionController.js (send-connection-request flow)
 *   - src/matching/matchingService.js (getMatches orchestrator)
 *
 * Uses the pre-existing subscriptoinRepository (filename typo retained intentionally).
 */
const findActivePrememiumSubscription = async (companyId, userId) => {
    try {
        const userPremiumSubscription = await subscriptoinRepository.findActivePrememiumSubscription(companyId, userId);
        return ServiceResponse.success({
            data: userPremiumSubscription,
            message: SUBSCRIPTION_MESSAGES.SUBSCRIPTION_FETCH_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SUBSCRIPTION_MESSAGES.SUBSCRIPTION_FETCH_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    getPlans,
    selectPlan,
    getUserSubscription,
    findActivePrememiumSubscription
};