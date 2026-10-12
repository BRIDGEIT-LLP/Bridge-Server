'use strict';

const ServiceResponse = require('../utils/ServiceResponse');

const {
    generateAccessToken,
    generateRefreshToken,
    verifyRefreshToken
} = require('../utils/token');

const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES } = require('../utils/constant');

const { v4: uuidv4 } = require('uuid');

/*
 * Changed from userSessionService to userSessionRepository.
 * With Option B (device chooser), session creation at login is a simple
 * INSERT with no eviction logic — eviction is now the user's explicit
 * choice via GET /sessions/limit-status + POST /sessions/revoke-selected.
 * The service layer's enforceMaxSessionsAndCreate is no longer called here.
 */
const userSessionRepository = require('../repositories/userSessionRepository');
const sessionCacheRepository = require('../repositories/sessionCacheRepository');

const { parseDeviceInfo } = require('../utils/deviceInfo');

const {
    SESSION_LIMIT_ENABLED
} = require('../configs/sessionConfig');


/**
 * Generates a pair of access and refresh tokens.
 *
 * Existing usage:
 *
 * generateTokens(company, role, user)
 *
 * New usage:
 *
 * generateTokens(company, role, user, {
 *     ipAddress,
 *     headers    ← full req.headers (replaces the old `userAgent` field)
 * })
 *
 * Passing the full headers object lets parseDeviceInfo() use the same
 * sec-ch-ua* Client Hint headers that requestResponseLogger.js already
 * reads, with ua-parser-js as a fallback for browsers that don't send them.
 */
const generateTokens = async (
    company,
    role,
    user,
    userType,
    requestMeta = {}
) => {

    try {

        const {
            ipAddress = null,
            headers   = {}         // changed from `userAgent` — full req.headers
        } = requestMeta;

        /*
         * Unique Session ID
         */
        const jti = uuidv4();

        /*
         * Keep ALL existing payload fields
         */
        const payload = {
            jti,

            companyId: company.id,
            email: company.company_email,
            companyName: company.company_name,

            mobileNumber: company.mobile_number,
            countryCode: company.country_code,

            role: role.role_code,
            roleId: role.id,

            userId: user.id,
            userName: user?.first_name,

            userType: userType
        };

        const accessToken =
            generateAccessToken(payload);

        const refreshToken =
            generateRefreshToken(payload);

        /*
         * Create session record — no auto-eviction.
         *
         * Previously this called enforceMaxSessionsAndCreate(), which
         * silently evicted the oldest session if the user was already at
         * the limit. With Option B (device chooser flow), that decision
         * belongs to the user, not the system:
         *
         *   1. Login → session created here (count may temporarily exceed
         *      MAX_ACTIVE_SESSIONS by 1)
         *   2. After OTP → frontend calls GET /api/v1/sessions/limit-status
         *   3. If atLimit → frontend shows chooser modal
         *   4. User selects sessions to revoke → POST /api/v1/sessions/revoke-selected
         *   5. Count back within limit → redirect to dashboard
         *
         * The session is always created unconditionally here so that the
         * user has a valid token for steps 2–4 above.
         */
        if (SESSION_LIMIT_ENABLED) {

            const deviceInfo = parseDeviceInfo(headers);   // changed from parseDeviceInfo(userAgent)

            /*
             * Match refresh token expiry
             *
             * Current .env:
             * REFRESH_TOKEN_EXPIRY=7d
             */
            const expiresAt = new Date(
                Date.now() +
                (7 * 24 * 60 * 60 * 1000)
            );

            try {
                await userSessionRepository.createSession(
                    user,
                    jti,
                    deviceInfo,
                    ipAddress,
                    expiresAt
                );
            } catch (sessionErr) {
                /*
                 * Never block login on a session-tracking failure — log
                 * it and still return the tokens below.
                 */
                errorLogger.error('Failed to create session during login:', sessionErr);
            }

            /*
             * Warm the Redis session:jti:{userId} cache with every currently
             * active session (Flow A — see docs/plans/redis-session-jti-cache.md)
             * so the user's first post-login request is already a cache hit
             * instead of a miss. Best-effort — never blocks login.
             */
            try {
                const activeSessions = await userSessionRepository.getActiveSessionsByUser(user.id);
                const activeJtis = activeSessions.map((session) => session.token_jti);
                await sessionCacheRepository.cacheActiveJtis(user.id, activeJtis);
            } catch (cacheErr) {
                errorLogger.error('Failed to warm session cache during login:', cacheErr);
            }
        }

        return ServiceResponse.success({
            data: {
                accessToken,
                refreshToken
            }
        });

    } catch (err) {

        errorLogger.error(err);

        return ServiceResponse.error({
            message:
                err.message ||
                'Error encountered while generating token.',
            data: []
        });
    }
};


const generateResetPasswordAcessToken = async (emailId) => {
    try {
        const payload = { emailId };
        const accessToken = await generateAccessToken(payload, TOKEN_TYPES.RESET_PASSWORD_ACCESS_TOKEN);
        return ServiceResponse.success({
            data: { accessToken }
        });
    } catch (err) {
        return ServiceResponse.error({
            message: err.message || 'Error encountered while generating and sending OTP.',
            data: []
        });
    }
};


/**
 * Create a new access token using a valid refresh token.
 *
 * Unchanged — already correctly carries the original `jti` forward
 * (userData.jti: decoded.jti), which is exactly the "same jti for the
 * session's whole lifetime" behavior this feature depends on. A refreshed
 * access token still gets caught by authMiddleware.js's session check if
 * its jti's session has since been revoked.
 */
const refreshToken = async (
    plainRefreshToken
) => {

    try {

        /*
         * Verify token signature and expiry
         */
        const userDecodedData =
            verifyRefreshToken(plainRefreshToken);

        const companyId =
            userDecodedData.companyId;

        if (!companyId) {

            return ServiceResponse.error({
                message:
                    AUTH_MESSAGES.TOKEN_REFRESH_FAILED,
                statusCode: 401
            });
        }

        // const decod = {
        //     jti: decoded.jti,

        //     companyId: decoded.companyId,
        //     email: decoded.email,
        //     companyName: decoded.companyName,

        //     mobileNumber: decoded.mobileNumber,
        //     countryCode: decoded.countryCode,

        //     role: decoded.role,
        //     roleId: decoded.roleId,

        //     userId: decoded.userId,
        //     userName: decoded.userName
        // };

        /*
         * Create a new access token
         */
        const newAccessToken =
            await generateAccessToken(
                userDecodedData
            );

        return ServiceResponse.success({

            message:
                AUTH_MESSAGES.TOKEN_REFRESH_SUCCESS,

            data: {
                accessToken:
                    newAccessToken
            }
        });

    } catch (error) {

        errorLogger.error(error);

        if (error.name === 'TokenExpiredError') {

            return ServiceResponse.error({
                message:
                    AUTH_MESSAGES.ACCESS_TOKEN_EXPIRED,
                statusCode: 401
            });
        }

        if (error.name === 'JsonWebTokenError') {

            return ServiceResponse.error({
                message:
                    AUTH_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 401
            });
        }

        return ServiceResponse.error({
            message:
                AUTH_MESSAGES.UNAUTHORIZED,
            statusCode: 500
        });
    }
};
const generateMfaAccessToken = async (company, role, user, userType) => {
    try {
        const payload = {
            companyId: company.id,
            email: company.company_email,
            companyName: company.company_name,

            mobileNumber: company.mobile_number,
            countryCode: company.country_code,

            role: role.role_code,
            roleId: role.id,

            userId: user.id,
            userName: user?.first_name,

            userType: userType
        };

        const accessToken = await generateAccessToken(payload, TOKEN_TYPES.MFA_ACCESS_TOKEN);

        return ServiceResponse.success({
            data: { accessToken }
        });
    } catch (err) {
        errorLogger.error(err);
        return ServiceResponse.error({
            message: err.message || 'Error encountered while generating token.',
            data: []
        });
    }
};


module.exports = {
    generateTokens,
    refreshToken,
    generateResetPasswordAcessToken,
    generateMfaAccessToken
};