'use strict';

const { errorLogger } = require('../configs/logger');
const permissionService = require('../services/permissionService');
const { AUTH_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

/**
 * Route-level permission gate. Must run after authMiddleware/adminMiddleware/
 * mfaMiddleware so req.userType is already set.
 */
const authorize = (permissionKey) => async (req, res, next) => {
    try {
        const allowed = await permissionService.hasPermission(req.userType, permissionKey);

        if (!allowed) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.FORBIDDEN,
                statusCode: 403
            });
        }

        next();
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: AUTH_MESSAGES.UNAUTHORIZED,
            statusCode: 500
        });
    }
};

module.exports = authorize;
