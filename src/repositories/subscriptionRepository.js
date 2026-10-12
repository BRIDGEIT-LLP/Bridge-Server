'use strict';

const { UserSubscription, SubscriptionPlan } = require('../models');

/**
 * Creates a new user_subscription row inside a sequelize transaction.
 */
const createSubscription = async (subscriptionData, { transaction } = {}) => {
    return await UserSubscription.create(subscriptionData, { transaction });
};

/**
 * Returns the active (non-expired, non-deleted) subscription for a user+company,
 * including the joined plan details.
 */
const getActiveSubscription = async (userId, companyId) => {
    return await UserSubscription.findOne({
        where: {
            user_id: userId,
            company_id: companyId,
            status: 'active',
            is_deleted: false
        },
        include: [
            {
                model: SubscriptionPlan,
                as: 'plan',
                attributes: ['id', 'plan_name', 'plan_benefits', 'validity_days']
            }
        ]
    });
};

/**
 * Marks any existing active subscriptions for a user+company as 'cancelled'
 * before activating a new one. Runs inside the caller's transaction.
 */
const cancelActiveSubscriptions = async (userId, companyId, cancelledById, { transaction } = {}) => {
    const [updatedCount] = await UserSubscription.update(
        {
            status: 'cancelled',
            updated_at: new Date(),
            updated_by: cancelledById
        },
        {
            where: {
                user_id: userId,
                company_id: companyId,
                status: 'active',
                is_deleted: false
            },
            transaction
        }
    );
    return updatedCount;
};

module.exports = { createSubscription, getActiveSubscription, cancelActiveSubscriptions };