'use strict';

const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES, ADMIN_USER_TYPES, ROLES, USER_SUSPENSION_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { verifyAccessToken, COOKIE_NAMES, clearCookieOptions } = require('../utils/token');

const userSessionRepository = require('../repositories/userSessionRepository');
const sessionCacheRepository = require('../repositories/sessionCacheRepository');
const suspensionCacheRepository = require('../repositories/suspensionCacheRepository');
const userRepository = require('../repositories/userRepository');
const userSuspensionHistoryRepository = require('../repositories/userSuspensionHistoryRepository');
const { SESSION_LIMIT_ENABLED } = require('../configs/sessionConfig');

/**
 * Redis-cached JTI check. Reads session:jti:{userId} first; on a cache miss
 * rebuilds it from Postgres (source of truth) and re-checks. If Redis itself
 * errors, falls back to the direct Postgres check that existed before this
 * cache was added, so a Redis outage never blocks authenticated traffic.
 */
const isSessionJtiValid = async (userId, jti) => {
    try {
        const status = await sessionCacheRepository.checkJti(userId, jti);

        if (status !== 'MISS') {
            return status === 'VALID';
        }

        const activeSessions = await userSessionRepository.getActiveSessionsByUser(userId);
        const activeJtis = activeSessions.map((session) => session.token_jti);

        await sessionCacheRepository.cacheActiveJtis(userId, activeJtis);

        return activeJtis.includes(jti);
    } catch (error) {
        errorLogger.error('[authMiddleware] Redis session check failed, falling back to DB:', error.message);

        const session = await userSessionRepository.findSessionByJti(jti, userId);

        if (!session || session.is_revoked) {
            return false;
        }

        if (session.expires_at && new Date(session.expires_at) < new Date()) {
            return false;
        }

        return true;
    }
};

/**
 * Suspension lookup. Normal path is a synchronous, in-memory Map read (no
 * network call at all — see suspensionCacheRepository's in-process mirror of
 * the suspended_users Redis hash). The only time this falls back to Redis or
 * Postgres is the brief cold-start window before the boot-time hydration
 * (suspensionCacheService.loadSuspendedUsersIntoCache) has completed, so a
 * suspended user can never slip through right after a restart either.
 */
const checkUserSuspension = async (userId) => {
    if (suspensionCacheRepository.isMemoryHydrated()) {
        return suspensionCacheRepository.getSuspensionFromMemory(userId);
    }

    try {
        return await suspensionCacheRepository.getSuspension(userId);
    } catch (error) {
        errorLogger.error('[authMiddleware] Redis suspension check failed, falling back to DB:', error.message);

        const user = await userRepository.getUserById(userId);
        if (!user?.is_user_suspended) {
            return null;
        }

        const latestHistory = await userSuspensionHistoryRepository.findLatestByUserId(userId);
        return { reason: latestHistory?.suspension_reason ?? null };
    }
};

/**
 * Middleware to authenticate requests via JWT access token.
 */
const authMiddleware = async (req, res, next) => {
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

        // TODO: remove it after admn jti implemented
        // if (!ROLES.USER.includes(decoded.role)) {
        //     return HttpResponse.error(res, {
        //         message: AUTH_MESSAGES.FORBIDDEN,
        //         statusCode: 403
        //     });
        // }

        // Attach decoded payload to request object
        req.companyId = decoded.companyId;
        req.companyName = decoded.companyName;
        req.email = decoded.email;
        req.mobileNumber = decoded.mobileNumber;
        req.countryCode = decoded.countryCode;
        req.userId = decoded.userId;
        req.roleId = decoded.roleId;
        req.role = decoded.role;
        req.userType = decoded.userType;
        req.jti = decoded?.jti; // lets controllers flag the current session

        // Per-request suspension check — runs for every decoded token, regardless of user type.
        // Must run BEFORE session validation so a suspended user gets kicked out immediately
        // even if their session JTI is still valid in the DB/cache.
        const suspension = await checkUserSuspension(decoded.userId);

        if (suspension) {
            res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
            res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());
            return HttpResponse.error(res, {
                message: USER_SUSPENSION_MESSAGES.ACCOUNT_SUSPENDED,
                statusCode: 403,
                data: { is_user_suspended: true, reason: suspension.reason ?? null }
            });
        }

        /*
         * Per-request session validation.
         *
         * Skipped for ADMIN / SUPER_ADMIN: their tokens are issued by
         * adminService, which carries `adminId` (not `userId`) and never
         * creates a user_sessions row, so there is nothing to validate
         * against. Admin routes are guarded by adminMiddleware instead.
         */
        if (SESSION_LIMIT_ENABLED && !ADMIN_USER_TYPES.includes(decoded.userType)) {

            const { jti, userId } = decoded;

            if (!jti) {
                return HttpResponse.error(res, {
                    message: AUTH_MESSAGES.UNAUTHORIZED,
                    statusCode: 401
                });
            }

            const isValid = await isSessionJtiValid(userId, jti);

            if (!isValid) {
                return HttpResponse.error(res, {
                    message: AUTH_MESSAGES.UNAUTHORIZED,
                    statusCode: 401
                });
            }

            await userSessionRepository.updateLastActivity(
                userId,
                jti
            );
        }

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

module.exports = authMiddleware;