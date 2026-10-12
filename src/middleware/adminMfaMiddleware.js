'use strict';
const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { verifyAccessToken, COOKIE_NAMES } = require('../utils/token');

/**
 * Middleware for the admin login MFA flow (select-channel / verify-otp / resend-otp).
 *
 * Authenticates the short-lived pre-MFA token (TOKEN_TYPES.MFA_ACCESS_TOKEN)
 * issued at admin login. It is verified against the MFA secret, so a full app
 * token won't be accepted here and this token won't be accepted by adminMiddleware.
 * Once MFA passes, verify-otp exchanges it for the full AUTH_ACCESS_TOKEN pair.
 * Mirrors mfaMiddleware, but attaches the admin payload fields.
 */
const adminMfaMiddleware = (req, res, next) => {
    try {
        const token = req.cookies?.[COOKIE_NAMES.MFA_TOKEN];
        if (!token) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.ACCESS_TOKEN_UNAUTHORIZED,
                statusCode: 401
            });
        }

        const decoded = verifyAccessToken(token, TOKEN_TYPES.MFA_ACCESS_TOKEN);

        if (decoded.type !== TOKEN_TYPES.MFA_ACCESS_TOKEN) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 401
            });
        }

        // Attach decoded payload the MFA controllers read, and that verify-otp
        // reuses to mint the full token.
        req.adminId = decoded.adminId;
        req.email = decoded.email;
        req.mobileNumber = decoded.mobileNumber;
        req.role = decoded.role;
        req.userType = decoded.userType;
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

module.exports = adminMfaMiddleware;
