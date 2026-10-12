'use strict';

const { errorLogger } = require('../configs/logger');
const { AUTH_MESSAGES, TOKEN_TYPES, ADMIN_USER_TYPES, ADMIN_MANAGEMENT_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { verifyAccessToken, COOKIE_NAMES } = require('../utils/token');

const adminManagementRepository = require('../repositories/adminManagementRepository');
const adminSuspensionCacheRepository = require('../repositories/adminSuspensionCacheRepository');
const adminSuspensionHistoryRepository = require('../repositories/adminSuspensionHistoryRepository');

const adminSessionRepository = require('../repositories/adminSessionRepository');
const adminSessionCacheRepository = require('../repositories/adminSessionCacheRepository');
const { SESSION_LIMIT_ENABLED } = require('../configs/sessionConfig');

/**
 * Suspension lookup for admins. Normal path is a synchronous, in-memory Map read (no
 * network call at all — see adminSuspensionCacheRepository's in-process mirror
 * of the suspended_admins Redis hash). The only time this falls back to Redis
 * or Postgres is the brief cold-start window before the boot-time hydration
 * (adminSuspensionCacheService.loadSuspendedAdminsIntoCache) has completed, so
 * a suspended admin can never slip through right after a restart either.
 */
const checkAdminSuspension = async (adminId) => {
    if (adminSuspensionCacheRepository.isMemoryHydrated()) {
        return adminSuspensionCacheRepository.getSuspensionFromMemory(adminId);
    }

    try {
        return await adminSuspensionCacheRepository.getSuspension(adminId);
    } catch (error) {
        errorLogger.error('[adminMiddleware] Redis suspension check failed, falling back to DB:', error.message);

        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin || !admin.is_admin_suspended) {
            return null;
        }

        const latestHistory = await adminSuspensionHistoryRepository.findLatestByAdminId(adminId);
        return { reason: latestHistory?.suspension_reason ?? null };
    }
};

/**
 * Redis-cached JTI check for admin sessions.
 * Reads session:admin:jti:{adminId} first; on a cache miss rebuilds it from
 * Postgres and re-checks. If Redis errors, falls back to a direct Postgres
 * lookup so a Redis outage never blocks authenticated admin traffic.
 *
 * Mirrors isSessionJtiValid in authMiddleware, but uses admin repositories.
 */
const isAdminSessionJtiValid = async (adminId, jti) => {
    try {
        const status = await adminSessionCacheRepository.checkJti(adminId, jti);

        if (status !== 'MISS') {
            return status === 'VALID';
        }

        // Cache miss — rebuild from Postgres (source of truth)
        const activeSessions = await adminSessionRepository.getActiveSessionsByAdmin(adminId);
        const activeJtis = activeSessions.map((s) => s.token_jti);

        await adminSessionCacheRepository.cacheActiveJtis(adminId, activeJtis);

        return activeJtis.includes(jti);
    } catch (error) {
        errorLogger.error('[adminMiddleware] Redis session check failed, falling back to DB:', error.message);

        // Postgres fallback — a Redis outage must never block admin access
        const session = await adminSessionRepository.findSessionByJti(jti, adminId);

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
 * Middleware to authenticate admin requests via JWT access token.
 *
 * Flow:
 *  1. Verify JWT signature and token type
 *  2. Verify userType is admin/super-admin
 *  3. Check if admin is suspended — reject immediately if so
 *  4. Validate session JTI against admin_session table if SESSION_LIMIT_ENABLED
 *  5. Update last_activity_at for this session
 *  6. Attach decoded payload to req and pass control to the route handler
 *
 * Changes from the original synchronous version:
 *  - Made async to support await-based session + suspension validation
 *  - Sets req.jti so controllers can reference the current session
 *  - When SESSION_LIMIT_ENABLED, validates the JTI against admin_session
 *    (Redis-first, Postgres fallback) and updates last_activity_at
 *  - Checks admin suspension before session validation so suspended admins
 *    are rejected immediately regardless of session state
 */
const adminMiddleware = async (req, res, next) => {
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

        if (!ADMIN_USER_TYPES.includes(decoded.userType)) {
            return HttpResponse.error(res, {
                message: AUTH_MESSAGES.FORBIDDEN,
                statusCode: 403
            });
        }

        // Per-request suspension check — runs for every decoded admin token.
        // Must run BEFORE session validation so a suspended admin gets kicked out
        // immediately even if their session JTI is still valid in the DB/cache.
        const suspension = await checkAdminSuspension(decoded.adminId);

        if (suspension) {
            return HttpResponse.error(res, {
                message: ADMIN_MANAGEMENT_MESSAGES.ACCOUNT_SUSPENDED,
                statusCode: 403,
                data: { is_admin_suspended: true, reason: suspension.reason ?? null }
            });
        }

        // Attach decoded payload to request object
        req.email = decoded.email;
        req.mobileNumber = decoded.mobileNumber;
        req.role = decoded.role;
        req.userType = decoded.userType;
        req.adminId = decoded.adminId;
        req.jti = decoded.jti; // needed by session controllers and logout

        // Per-request session validation — validate JTI is still active
        // and update the last-activity timestamp.
        if (SESSION_LIMIT_ENABLED) {
            const { jti, adminId } = decoded;

            if (!jti) {
                return HttpResponse.error(res, {
                    message: AUTH_MESSAGES.UNAUTHORIZED,
                    statusCode: 401
                });
            }

            const isValid = await isAdminSessionJtiValid(adminId, jti);

            if (!isValid) {
                return HttpResponse.error(res, {
                    message: AUTH_MESSAGES.UNAUTHORIZED,
                    statusCode: 401
                });
            }

            await adminSessionRepository.updateLastActivity(adminId, jti);
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

module.exports = adminMiddleware;