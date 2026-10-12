'use strict';
const { sequelize } = require('../models');
const userSessionRepository = require('../repositories/userSessionRepository');
const sessionCacheRepository = require('../repositories/sessionCacheRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { SESSION_MESSAGES } = require('../utils/constant');

/**
 * Used by GET /api/v1/sessions.
 * Returns all active sessions for the user, flagging which one is current.
 */
const getActiveSessions = async (userId, currentJti) => {
    try {
        const sessions = await userSessionRepository.getActiveSessionsByUser(userId);

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
 * Used by DELETE /api/v1/sessions/:sessionId.
 */
const revokeSession = async (userId, sessionId) => {
    try {
        const session = await userSessionRepository.revokeSessionById(userId, sessionId);

        if (!session) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_NOT_FOUND,
                statusCode: 404
            });
        }

        await sessionCacheRepository.removeJti(userId, session.token_jti);

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
 * Used by POST /api/v1/sessions/logout-all.
 */
const logoutAllSessions = async (userId) => {
    try {
        await userSessionRepository.revokeAllSessionsByUser(userId);
        await sessionCacheRepository.invalidateUser(userId);
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
 * Same effect as logoutAllSessions, called automatically from the password
 * reset/change flow. Separate exported name so the call site reads clearly.
 */
const revokeAllSessionsOnPasswordReset = async (userId) => {
    return logoutAllSessions(userId);
};

/**
 * Used by POST /api/v1/sessions/logout — the sidebar Logout button.
 *
 * Revokes only the current session (the one identified by the token the
 * user is sending right now), leaving all other devices untouched. This
 * is the "single-device logout" counterpart to logoutAllSessions.
 *
 * Returns success even if no session row is found (e.g. SESSION_LIMIT_ENABLED
 * was false when this token was issued and no row was ever created) — the
 * user's intent to logout should always succeed regardless.
 */
const logoutCurrentSession = async (userId, jti) => {
    try {
        const session = await userSessionRepository.findSessionByJti(jti, userId);

        if (!session) {
            // No session row exists for this token — nothing to revoke.
            // Return success so the frontend still completes its local logout.
            return ServiceResponse.success({
                message: SESSION_MESSAGES.LOGOUT_SUCCESS,
                statusCode: 200
            });
        }

        if (!session.is_revoked) {
            session.is_revoked = true;
            await session.save();
        }

        await sessionCacheRepository.removeJti(userId, jti);

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
 * Used by GET /api/v1/sessions/limit-status — called by the frontend after
 * OTP verification, before redirecting to dashboard.
 *
 * At this point the user's new session has already been created in
 * tokenService.generateTokens(). So:
 *   - activeSessions includes the new (current) session
 *   - We exclude the current session from what we return to the frontend,
 *     since the user should only see and choose from their *other* sessions
 *   - atLimit is true if other sessions alone >= maxSessions, meaning the
 *     user needs to free at least one slot
 */
const getSessionLimitStatus = async (userId, currentJti, maxSessions) => {
    try {
        const activeSessions = await userSessionRepository.getActiveSessionsByUser(userId);

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
 * Used by POST /api/v1/sessions/revoke-selected — called after the user
 * picks which device(s) to log out in the chooser modal.
 */
const revokeSelectedSessions = async (userId, sessionIds, maxSessions) => {
    try {
        if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_SELECTION_REQUIRED,
                statusCode: 400
            });
        }

        const activeSessions = await userSessionRepository.getActiveSessionsByUser(userId);
        const activeIds = new Set(activeSessions.map((session) => session.id));
        const validSelectedIds = sessionIds.filter((id) => activeIds.has(id));

        if (validSelectedIds.length !== sessionIds.length) {
            return ServiceResponse.error({
                message: SESSION_MESSAGES.SESSION_SELECTION_INVALID,
                statusCode: 400
            });
        }

        const requiredRevocations = activeSessions.length - maxSessions;

        if (requiredRevocations > 0 && validSelectedIds.length < requiredRevocations) {
            return ServiceResponse.error({
                message: `Please select at least ${requiredRevocations} device(s) to log out.`,
                statusCode: 400
            });
        }

        await userSessionRepository.revokeSessionsByIds(userId, validSelectedIds);

        const revokedJtis = activeSessions
            .filter((session) => validSelectedIds.includes(session.id))
            .map((session) => session.token_jti);

        await Promise.all(
            revokedJtis.map((jti) => sessionCacheRepository.removeJti(userId, jti))
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
 * NOT called in the current Option B flow — preserved for potential future use.
 */
const enforceMaxSessionsAndCreate = async (userObj, jti, deviceInfo, ipAddress, expiresAt, maxSessions) => {
    const transaction = await sequelize.transaction();
    try {
        const activeSessions = await userSessionRepository.getActiveSessionsByUser(userObj.id, { transaction });

        if (activeSessions.length >= maxSessions) {
            await userSessionRepository.revokeOldestActiveSession(userObj.id, { transaction });
        }

        const session = await userSessionRepository.createSession(
            userObj, jti, deviceInfo, ipAddress, expiresAt, { transaction }
        );

        await transaction.commit();
        return ServiceResponse.success({
            message: SESSION_MESSAGES.SESSION_CREATE_SUCCESS,
            data: session,
            statusCode: 201
        });
    } catch (error) {
        if (!transaction.finished) {
            await transaction.rollback();
        }
        errorLogger.error(error);
        return ServiceResponse.error({
            message: SESSION_MESSAGES.SESSION_CREATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    getActiveSessions,
    revokeSession,
    logoutAllSessions,
    revokeAllSessionsOnPasswordReset,
    logoutCurrentSession,
    getSessionLimitStatus,
    revokeSelectedSessions,
    enforceMaxSessionsAndCreate
};