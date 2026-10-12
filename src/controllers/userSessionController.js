'use strict';
const { errorLogger } = require('../configs/logger');
const userSessionService = require('../services/userSessionService');
const { SESSION_MESSAGES, USER_ROLES_CODE } = require('../utils/constant');
const { MAX_ACTIVE_SESSIONS } = require('../configs/sessionConfig');
const HttpResponse = require('../utils/HttpResponse');
const { COOKIE_NAMES, clearCookieOptions } = require('../utils/token');

/**
 * GET /api/v1/sessions
 */
const getActiveSessions = async (req, res, next) => {
    try {
        const userId = req.userId;
        const currentJti = req.jti;

        const sessionsResponse = await userSessionService.getActiveSessions(userId, currentJti);

        if (!sessionsResponse.success) {
            return HttpResponse.error(res, {
                message: sessionsResponse.message,
                data: sessionsResponse.data,
                statusCode: sessionsResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: sessionsResponse.message,
            data: sessionsResponse.data,
            statusCode: sessionsResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.SESSION_LISTING_FAILED, statusCode: 500 });
    }
};

/**
 * DELETE /api/v1/sessions/:sessionId
 */
const revokeSession = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { sessionId } = req.params;

        const revokeResponse = await userSessionService.revokeSession(userId, sessionId);

        if (!revokeResponse.success) {
            return HttpResponse.error(res, {
                message: revokeResponse.message,
                data: revokeResponse.data,
                statusCode: revokeResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: revokeResponse.message,
            data: revokeResponse.data,
            statusCode: revokeResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.SESSION_REVOKE_FAILED, statusCode: 500 });
    }
};

/**
 * POST /api/v1/sessions/logout-all
 */
const logoutAllSessions = async (req, res, next) => {
    try {
        const userId = req.userId;

        const logoutResponse = await userSessionService.logoutAllSessions(userId);

        if (!logoutResponse.success) {
            return HttpResponse.error(res, {
                message: logoutResponse.message,
                data: logoutResponse.data,
                statusCode: logoutResponse.statusCode
            });
        }
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, {
            message: logoutResponse.message,
            data: logoutResponse.data,
            statusCode: logoutResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.LOGOUT_ALL_FAILED, statusCode: 500 });
    }
};

/**
 * POST /api/v1/sessions/logout
 *
 * Called by the sidebar Logout button. Revokes only the current device's
 * session — leaves all other active sessions untouched.
 *
 * No request body needed. The current session is identified by the jti
 * embedded in the Bearer token, which authMiddleware.js already decoded
 * and attached to req.jti before this controller runs.
 *
 * Always returns 200 so the frontend can safely complete its local logout
 * (clear tokens, redirect to /login) even if the DB row wasn't found.
 */
const logoutCurrentSession = async (req, res, next) => {
    try {
        const userId = req.userId;
        const jti = req.jti;

        const logoutResponse = await userSessionService.logoutCurrentSession(userId, jti);

        if (!logoutResponse.success) {
            return HttpResponse.error(res, {
                message: logoutResponse.message,
                statusCode: logoutResponse.statusCode
            });
        }
        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, {
            message: logoutResponse.message,
            statusCode: logoutResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.LOGOUT_FAILED, statusCode: 500 });
    }
};

/**
 * GET /api/v1/sessions/limit-status
 */
const getSessionLimitStatus = async (req, res, next) => {
    try {
        const userId = req.userId;
        const currentJti = req.jti;
        
        if (Object.keys(USER_ROLES_CODE).includes(req.role)) {
            const limitStatusResponse = await userSessionService.getSessionLimitStatus(
                userId,
                currentJti,
                MAX_ACTIVE_SESSIONS
            );

            if (!limitStatusResponse.success) {
                return HttpResponse.error(res, {
                    message: limitStatusResponse.message,
                    statusCode: limitStatusResponse.statusCode
                });
            }

            return HttpResponse.success(res, {
                message: limitStatusResponse.message,
                data: limitStatusResponse.data,
                statusCode: limitStatusResponse.statusCode
            });

        }
        else {
            return HttpResponse.success(res)
        }
        
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.SESSION_LISTING_FAILED, statusCode: 500 });
    }
};

/**
 * POST /api/v1/sessions/revoke-selected
 */
const revokeSelectedSessions = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { sessionIds } = req.body;

        const revokeResponse = await userSessionService.revokeSelectedSessions(
            userId,
            sessionIds,
            MAX_ACTIVE_SESSIONS
        );

        if (!revokeResponse.success) {
            return HttpResponse.error(res, {
                message: revokeResponse.message,
                statusCode: revokeResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: revokeResponse.message,
            data: revokeResponse.data,
            statusCode: revokeResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.SESSION_REVOKE_FAILED, statusCode: 500 });
    }
};

module.exports = {
    getActiveSessions,
    revokeSession,
    logoutAllSessions,
    logoutCurrentSession,
    getSessionLimitStatus,
    revokeSelectedSessions
};