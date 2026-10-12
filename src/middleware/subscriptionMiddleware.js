'use strict';

const { errorLogger } = require('../configs/logger');
const { SUBSCRIPTION_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { UserSubscription } = require('../models');

const subscriptionMiddleware = async (req, res, next) => {
    try {
        const activeSubscription = await UserSubscription.findOne({
            where: {
                user_id: req.userId,
                company_id: req.companyId,
                status: 'active',
                is_deleted: false
            }
        });

        if (!activeSubscription) {
            return HttpResponse.error(res, {
                message: SUBSCRIPTION_MESSAGES.NO_ACTIVE_SUBSCRIPTION,
                statusCode: 403
            });
        }

        if (new Date(activeSubscription.end_date) < new Date()) {
            return HttpResponse.error(res, {
                message: SUBSCRIPTION_MESSAGES.SUBSCRIPTION_EXPIRED,
                statusCode: 403
            });
        }

        req.subscription = activeSubscription;
        next();
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SUBSCRIPTION_MESSAGES.SUBSCRIPTION_CHECK_FAILED,
            statusCode: 500
        });
    }
};

module.exports = subscriptionMiddleware;
