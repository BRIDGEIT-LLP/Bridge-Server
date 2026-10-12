'use strict';

const { SubscriptionPlan } = require('../models');

/**
 * Returns all active, non-deleted plans ordered by validity_days ascending
 * (Monthly first, Yearly second).
 */
const getActivePlans = async () => {
    return await SubscriptionPlan.findAll({
        where: {
            is_active: true,
            is_deleted: false
        },
        attributes: ['id', 'plan_name', 'plan_benefits', 'validity_days'],
        order: [['validity_days', 'ASC']]
    });
};

/**
 * Find a single plan by primary key, used before creating a subscription
 * to validate the requested plan_id.
 */
const getPlanById = async (planId) => {
    return await SubscriptionPlan.findOne({
        where: {
            id: planId,
            is_active: true,
            is_deleted: false
        },
        attributes: ['id', 'plan_name', 'plan_benefits', 'validity_days']
    });
};

module.exports = { getActivePlans, getPlanById };