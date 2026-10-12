'use strict';

const { errorLogger } = require('../configs/logger');
const { SESSION_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { COOKIE_NAMES, clearCookieOptions } = require('../utils/token');
const adminSessionService = require('../services/adminSessionService');
const { MAX_ACTIVE_SESSIONS } = require('../configs/sessionConfig');

/**
 * GET /api/v1/admin/sessions
 * List all active sessions for the authenticated admin.
 * The current session is flagged with { current: true }.
 * req.adminId and req.jti are set by adminMiddleware.
 */
const listSessions = async (req, res, next) => {
    try {
        const { adminId, jti } = req;

        const result = await adminSessionService.getActiveSessions(adminId, jti);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.SESSION_LISTING_FAILED,
            statusCode: 500
        });
    }
};

/**
 * GET /api/v1/admin/sessions/limit-status
 * Called by the frontend immediately after OTP verify to decide whether
 * to show the device-chooser modal.
 * Response: { atLimit: boolean, activeSessions: [] }
 */
const getSessionLimitStatus = async (req, res, next) => {
    try {
        const { adminId, jti } = req;

        const result = await adminSessionService.getSessionLimitStatus(adminId, jti, MAX_ACTIVE_SESSIONS);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            data: result.data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.SESSION_LISTING_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/logout
 * Revoke the current session only and clear auth cookies.
 * Used by the frontend's sidebar Logout button (via AuthProvider.logout).
 */
const logoutCurrentSession = async (req, res, next) => {
    try {
        const { adminId, jti } = req;

        const result = await adminSessionService.logoutCurrentSession(adminId, jti);
        if (!result.success) {
            // Log but proceed — cookies must always be cleared regardless
            errorLogger.error('[adminSessionController.logoutCurrentSession] Session revocation failed:', result.message);
        }

        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, {
            message: SESSION_MESSAGES.LOGOUT_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.LOGOUT_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/logout-all
 * Revoke all sessions for this admin and clear auth cookies.
 */
const logoutAllSessions = async (req, res, next) => {
    try {
        const { adminId } = req;

        const result = await adminSessionService.logoutAllSessions(adminId);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, {
            message: result.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.LOGOUT_ALL_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/sessions/revoke-selected
 * Device-chooser modal: revoke a caller-chosen set of sessions.
 * Body: { sessionIds: string[] }
 */
const revokeSelectedSessions = async (req, res, next) => {
    try {
        const { adminId } = req;
        const { sessionIds } = req.body;

        if (!Array.isArray(sessionIds)) {
            return HttpResponse.error(res, {
                message: SESSION_MESSAGES.SESSION_SELECTION_REQUIRED,
                statusCode: 400
            });
        }

        const result = await adminSessionService.revokeSelectedSessions(adminId, sessionIds, MAX_ACTIVE_SESSIONS);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.SESSION_REVOKE_FAILED,
            statusCode: 500
        });
    }
};

/**
 * DELETE /api/v1/admin/sessions/:sessionId
 * Revoke a single specific session by its ID.
 */
const revokeOneSession = async (req, res, next) => {
    try {
        const { adminId } = req;
        const { sessionId } = req.params;

        const result = await adminSessionService.revokeSession(adminId, sessionId);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: SESSION_MESSAGES.SESSION_REVOKE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    listSessions,
    getSessionLimitStatus,
    logoutCurrentSession,
    logoutAllSessions,
    revokeSelectedSessions,
    revokeOneSession
};
