'use strict';
const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES, EMAIL_BLOCK_MESSAGES } = require('../utils/constant');
const emailBlockService = require('../services/emailBlockService');
const HttpResponse = require('../utils/HttpResponse');
const { verifyAccessToken, COOKIE_NAMES, clearCookieOptions } = require('../utils/token');
/**
 * Middleware for the login MFA flow (select-channel / verify-otp / resend-otp).
 *
 * Authenticates the short-lived pre-MFA token (TOKEN_TYPES.MFA_ACCESS_TOKEN)
 * issued at login. It is verified against its own secret, so a full app token
 * won't be accepted here and — more importantly — this token won't be accepted
 * by the application's authMiddleware. Once MFA passes, verify-otp exchanges it
 * for the full AUTH_ACCESS_TOKEN pair. Mirrors resetPasswordMiddleware.
 */
const mfaMiddleware = async (req, res, next) => {
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

        // A blocked email must not complete the OTP step with a token issued before
        // the block. Fails closed: a lookup error stops the request too.
        const blockRes = await emailBlockService.checkEmail(decoded.email);
        if (!blockRes.success) {
            return HttpResponse.error(res, { message: blockRes.message, statusCode: blockRes.statusCode });
        }
        if (blockRes.data.blocked) {
            res.clearCookie(COOKIE_NAMES.MFA_TOKEN, clearCookieOptions());
            return HttpResponse.error(res, { message: EMAIL_BLOCK_MESSAGES.BLOCKED, statusCode: 403 });
        }

        // Attach decoded payload to request object (same fields the MFA
        // controllers read, and that verify-otp reuses to mint the full token).
        req.companyId = decoded.companyId;
        req.companyName = decoded.companyName;
        req.email = decoded.email;
        req.mobileNumber = decoded.mobileNumber;
        req.countryCode = decoded.countryCode;
        req.userId = decoded.userId;
        req.roleId = decoded.roleId;
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

module.exports = mfaMiddleware;
