'use strict';
const { Op } = require('sequelize');
const { UserSession } = require('../models');

// Throttle window for last_activity_at writes — see updateLastActivity below.
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000; // 1 minute

const createSession = async (user, jti, deviceInfo = {}, ipAddress, expiresAt, { transaction } = {}) => {
    return await UserSession.create({
        user_id: user.id,
        token_jti: jti,
        device_name: deviceInfo.deviceName || null,
        browser: deviceInfo.browser || null,
        os: deviceInfo.os || null,
        ip_address: ipAddress || null,
        last_activity_at: new Date(),
        expires_at: expiresAt || null,
        is_revoked: false
    }, { transaction });
};

const getActiveSessionsByUser = async (userId, { transaction } = {}) => {
    const now = new Date();
    return await UserSession.findAll({
        where: {
            user_id: userId,
            is_revoked: false,
            [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gt]: now } }]
        },
        order: [['created_at', 'ASC']],
        transaction
    });
};

// Used by GET /sessions and DELETE /sessions/:sessionId. Filtering by
// user_id alongside id is what stops a user revoking someone else's session.
const revokeSessionById = async (userId, sessionId) => {
    const session = await UserSession.findOne({ where: { id: sessionId, user_id: userId } });
    if (!session) return null;

    if (!session.is_revoked) {
        session.is_revoked = true;
        await session.save();
    }
    return session;
};

// Pure data step for the max-sessions rule: finds and revokes the single
// oldest active session for a user. The *decision* of whether to call this
// (i.e. "are we at the limit?") lives in userSessionService, not here.
const revokeOldestActiveSession = async (userId, { transaction } = {}) => {
    const [oldest] = await UserSession.findAll({
        where: { user_id: userId, is_revoked: false },
        order: [['created_at', 'ASC']],
        limit: 1,
        transaction
    });
    if (!oldest) return null;

    oldest.is_revoked = true;
    await oldest.save({ transaction });
    return oldest;
};

const revokeAllSessionsByUser = async (userId, { transaction } = {}) => {
    return await UserSession.update(
        { is_revoked: true },
        { where: { user_id: userId, is_revoked: false }, transaction }
    );
};

// Used by the "choose which device(s) to log out" login flow — revokes
// exactly the selected session IDs, scoped to this user (same ownership
// guard as revokeSessionById: a user can never revoke a session that
// isn't theirs, even by passing someone else's session id here).
const revokeSessionsByIds = async (userId, sessionIds, { transaction } = {}) => {
    const [affectedCount] = await UserSession.update(
        { is_revoked: true },
        { where: { id: sessionIds, user_id: userId, is_revoked: false }, transaction }
    );
    return affectedCount;
};

// Called on every authenticated request by authMiddleware.js directly
// (bypassing the service layer — see note in userSessionService.js).
const findSessionByJti = async (jti, userId) => {
    return await UserSession.findOne({ where: { token_jti: jti, user_id: userId } });
};

// Best-effort, throttled activity ping — also called directly from
// authMiddleware.js. Never throws; a failure here must not fail the
// underlying authenticated request.
const updateLastActivity = async (userId, jti) => {
    try {
        const session = await UserSession.findOne({
            where: { token_jti: jti, user_id: userId, is_revoked: false }
        });
        if (!session) return null;

        const lastMs = session.last_activity_at ? new Date(session.last_activity_at).getTime() : 0;
        if (Date.now() - lastMs < ACTIVITY_UPDATE_THROTTLE_MS) {
            return session; // within throttle window, skip the write
        }

        session.last_activity_at = new Date();
        await session.save();
        return session;
    } catch (error) {
        console.error('[userSessionRepository.updateLastActivity] failed:', error.message);
        return null;
    }
};

module.exports = {
    createSession,
    getActiveSessionsByUser,
    revokeSessionById,
    revokeOldestActiveSession,
    revokeAllSessionsByUser,
    revokeSessionsByIds,
    findSessionByJti,
    updateLastActivity
};