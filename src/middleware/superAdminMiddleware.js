'use strict';
const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { verifyAccessToken, COOKIE_NAMES } = require('../utils/token');

/**
 * Middleware to authenticate and authorise SUPER_ADMIN-only routes.
 *
 * Behaves identically to adminMiddleware but additionally enforces that
 * userType === 'SUPER_ADMIN'. Any ADMIN-role token will be rejected with 403.
 */
const superAdminMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAMES.ACCESS_TOKEN];
        if (!token) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.ACCESS_TOKEN_UNAUTHORIZED,
                statusCode: 401
            });
        }

        const decoded = verifyAccessToken(token);

        if (decoded.type !== TOKEN_TYPES.AUTH_ACCESS_TOKEN) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 401
            });
        }

        if (decoded.userType !== 'SUPER_ADMIN') {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.FORBIDDEN,
                statusCode: 403
            });
        }

        req.email = decoded.email;
        req.mobileNumber = decoded.mobileNumber;
        req.role = decoded.role;
        req.userType = decoded.userType;
        req.adminId = decoded.adminId;
        next();
    } catch (error) {
        errorLogger.error(error);
        if (error.name === 'TokenExpiredError') {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.ACCESS_TOKEN_EXPIRED,
                statusCode: 401
            });
        }
        if (error.name === 'JsonWebTokenError') {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 401
            });
        }
        return HttpResponse.error(res, {
            message: AUTH_MESSAGES.UNAUTHORIZED,
            statusCode: 500
        });
    }
};

module.exports = superAdminMiddleware;