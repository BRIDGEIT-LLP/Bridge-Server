'use strict';

const adminSessionRepository = require('../repositories/adminSessionRepository');
const adminSessionCacheRepository = require('../repositories/adminSessionCacheRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { SESSION_MESSAGES } = require('../utils/constant');

/**
 * GET /api/v1/admin/sessions
 * Returns all active sessions for the admin, flagging which one is current.
 * Response shape mirrors userSessionService.getActiveSessions (camelCase keys).
 */
const getActiveSessions = async (adminId, currentJti) => {
    try {
        const sessions = await adminSessionRepository.getActiveSessionsByAdmin(adminId);

        const data = sessions.map((session) => ({
            id: session.id,
            deviceName: session.device_name,
            browser: session.browser,
            os: session.os,
            ipAddress: session.ip_address,
            lastActivityAt: session.last_activity_at,
            createdAt: session.created_at,
            current: session.token_jti === currentJti
        }));

        return ServiceResponse.success({
            message: SESSION_MESSAGES.SESSION_LISTING_SUCCESS,
            data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_LISTING_FAILED,
            data: [],
            statusCode: 500
        });
    }
};

/**
 * GET /api/v1/admin/sessions/limit-status
 * Called by the frontend after OTP verify, before redirecting to dashboard.
 *
 * At this point the admin's new session has already been created in
 * adminController.verifyMfaOtp. So activeSessions includes the current one.
 * We exclude the current session from what we return — the admin can only
 * choose to revoke OTHER sessions to free up a slot.
 *
 * atLimit logic mirrors userSessionService exactly:
 *   atLimit = (other sessions count) >= maxSessions
 */
const getSessionLimitStatus = async (adminId, currentJti, maxSessions) => {
    try {
        const activeSessions = await adminSessionRepository.getActiveSessionsByAdmin(adminId);

        const otherSessions = activeSessions.filter(
            (session) => session.token_jti !== currentJti
        );
        const atLimit = otherSessions.length >= maxSessions;

        const data = otherSessions.map((session) => ({
            id: session.id,
            deviceName: session.device_name,
            browser: session.browser,
            os: session.os,
            ipAddress: session.ip_address,
            lastActivityAt: session.last_activity_at,
            createdAt: session.created_at
        }));

        return ServiceResponse.success({
            message: atLimit
                ? SESSION_MESSAGES.SESSION_LIMIT_REACHED
                : SESSION_MESSAGES.SESSION_LISTING_SUCCESS,
            data: { atLimit, activeSessions: data },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_LISTING_FAILED,
            statusCode: 500
        });
    }
};

/**
 * DELETE /api/v1/admin/sessions/:sessionId
 * Revoke a single session by its ID. Returns 404 if not found or wrong admin.
 */
const revokeSession = async (adminId, sessionId) => {
    try {
        const session = await adminSessionRepository.findSessionById(sessionId);

        if (!session || session.admin_id !== adminId) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_NOT_FOUND,
                statusCode: 404
            });
        }

        await adminSessionRepository.revokeSessionById(sessionId);
        await adminSessionCacheRepository.removeJti(adminId, session.token_jti);

        return ServiceResponse.success({
            message: SESSION_MESSAGES.SESSION_REVOKE_SUCCESS,
            data: { id: session.id },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_REVOKE_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/logout-all
 * Revoke all sessions for this admin.
 */
const logoutAllSessions = async (adminId) => {
    try {
        await adminSessionRepository.revokeAllSessions(adminId);
        await adminSessionCacheRepository.invalidateAdmin(adminId);

        return ServiceResponse.success({
            message: SESSION_MESSAGES.LOGOUT_ALL_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.LOGOUT_ALL_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/logout
 * Revoke only the current session (single-device logout).
 *
 * Returns success even if no session row exists — if SESSION_LIMIT_ENABLED
 * was false when the token was issued, no row was created, but logout should
 * still succeed so the frontend can complete its local cleanup.
 */
const logoutCurrentSession = async (adminId, jti) => {
    try {
        const session = await adminSessionRepository.findSessionByJti(jti, adminId);

        if (!session) {
            // No session row for this token — nothing to revoke.
            return ServiceResponse.success({
                message: SESSION_MESSAGES.LOGOUT_SUCCESS,
                statusCode: 200
            });
        }

        if (!session.is_revoked) {
            session.is_revoked = true;
            await session.save();
        }

        await adminSessionCacheRepository.removeJti(adminId, jti);

        return ServiceResponse.success({
            message: SESSION_MESSAGES.LOGOUT_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.LOGOUT_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/revoke-selected
 * Device-chooser flow: revoke a caller-selected set of sessions.
 *
 * Validates:
 *   1. sessionIds is a non-empty array
 *   2. All IDs belong to this admin (ownership guard)
 *   3. Enough sessions are being revoked to bring the count under maxSessions
 *      (mirrors the count validation in userSessionService.revokeSelectedSessions)
 */
const revokeSelectedSessions = async (adminId, sessionIds, maxSessions) => {
    try {
        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_SELECTION_REQUIRED,
                statusCode: 400
            });
        }

        const activeSessions = await adminSessionRepository.getActiveSessionsByAdmin(adminId);
        const activeIds = new Set(activeSessions.map((session) => session.id));
        const validSelectedIds = sessionIds.filter((id) => activeIds.has(id));

        if (validSelectedIds.length !== sessionIds.length) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_SELECTION_INVALID,
                statusCode: 400
            });
        }

        // Ensure the admin is revoking enough sessions to come under the limit.
        const requiredRevocations = activeSessions.length - maxSessions;
        if (requiredRevocations > 0 && validSelectedIds.length < requiredRevocations) {
            return ServiceResponse.error({
                message: `Please select at least ${requiredRevocations} device(s) to log out.`,
                statusCode: 400
            });
        }

        await adminSessionRepository.revokeSessionsByIds(adminId, validSelectedIds);

        // Remove the revoked JTIs from Redis individually (leaves other sessions' cache intact).
        const revokedJtis = activeSessions
            .filter((session) => validSelectedIds.includes(session.id))
            .map((session) => session.token_jti);

        await Promise.all(
            revokedJtis.map((jti) => adminSessionCacheRepository.removeJti(adminId, jti))
        );

        return ServiceResponse.success({
            message: SESSION_MESSAGES.SESSION_REVOKE_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_REVOKE_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Create a new admin session row and prime the Redis JTI cache.
 * Called from adminController.verifyMfaOtp after tokens are issued.
 *
 * NOTE: createSession (Postgres write) and cacheActiveJtis (Redis write) are
 * sequential awaits with no cross-store transaction. If cache priming fails
 * after the DB write succeeds, the session row is correct in Postgres and will
 * be rebuilt into cache on the next MISS in adminMiddleware — accepted risk,
 * consistent with the equivalent user-session flow in tokenService.
 *
 * Always returns a ServiceResponse so the controller never needs to try/catch —
 * a failure here must never block admin login.
 */
const createAndCacheSession = async (admin, jti, deviceInfo, ipAddress, expiresAt) => {
    try {
        await adminSessionRepository.createSession(admin, jti, deviceInfo, ipAddress, expiresAt);

        // Prime Redis so the very next authenticated request hits cache, not Postgres.
        const activeSessions = await adminSessionRepository.getActiveSessionsByAdmin(admin.id);
        const activeJtis = activeSessions.map((s) => s.token_jti);
        await adminSessionCacheRepository.cacheActiveJtis(admin.id, activeJtis);

        return ServiceResponse.success({
            message: SESSION_MESSAGES.SESSION_CREATE_SUCCESS,
            statusCode: 201
        });
    } catch (error) {
        errorLogger.error('[adminSessionService.createAndCacheSession]', error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_CREATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    getActiveSessions,
    getSessionLimitStatus,
    revokeSession,
    logoutAllSessions,
    logoutCurrentSession,
    revokeSelectedSessions,
    createAndCacheSession
};
