'use strict';

const { Op } = require('sequelize');
const { AdminSession } = require('../models');

// Throttle window for last_activity_at writes — mirrors userSessionRepository.
const ACTIVITY_UPDATE_THROTTLE_MS = 60 * 1000; // 1 minute

/**
 * Create a new admin session row.
 * Called from adminController.verifyMfaOtp after tokens are issued.
 *
 * @param {Object} admin         - Admin object with at least { id }
 * @param {string} jti           - JWT ID from the issued token
 * @param {Object} deviceInfo    - { deviceName, browser, os } from parseDeviceInfo()
 * @param {string} ipAddress     - req.ip
 * @param {Date}   expiresAt     - Mirrors refresh token expiry (7 days)
 */
const createSession = async (admin, jti, deviceInfo = {}, ipAddress, expiresAt) => {
    return AdminSession.create({
        admin_id: admin.id,
        token_jti: jti,
        device_name: deviceInfo.deviceName || null,
        browser: deviceInfo.browser || null,
        os: deviceInfo.os || null,
        ip_address: ipAddress || null,
        last_activity_at: new Date(),
        expires_at: expiresAt || null,
        is_revoked: false
    });
};

/**
 * Return all non-revoked, non-expired sessions for an admin, newest first.
 * Mirrors getActiveSessionsByUser: excludes rows where expires_at is in the past.
 */
const getActiveSessionsByAdmin = async (adminId) => {
    const now = new Date();
    return AdminSession.findAll({
        where: {
            admin_id: adminId,
            is_revoked: false,
            [Op.or]: [
                { expires_at: null },
                { expires_at: { [Op.gt]: now } }
            ]
        },
        order: [['created_at', 'ASC']]
    });
};

/**
 * Find a session by its JTI, scoped to the given admin.
 * Used as the Postgres fallback when Redis is unavailable.
 */
const findSessionByJti = async (jti, adminId) => {
    return AdminSession.findOne({
        where: {
            token_jti: jti,
            admin_id: adminId
        }
    });
};

/**
 * Find a session by its primary key (used for ownership validation in the service).
 */
const findSessionById = async (sessionId) => {
    return AdminSession.findByPk(sessionId);
};

/**
 * Best-effort, throttled activity ping.
 * Called directly from adminMiddleware on every authenticated admin request.
 * Never throws — a failure here must not fail the underlying request.
 * Mirrors updateLastActivity in userSessionRepository exactly.
 */
const updateLastActivity = async (adminId, jti) => {
    try {
        const session = await AdminSession.findOne({
            where: { token_jti: jti, admin_id: adminId, is_revoked: false }
        });
        if (!session) return null;

        const lastMs = session.last_activity_at
            ? new Date(session.last_activity_at).getTime()
            : 0;
        if (Date.now() - lastMs < ACTIVITY_UPDATE_THROTTLE_MS) {
            return session; // within throttle window — skip the write
        }

        session.last_activity_at = new Date();
        await session.save();
        return session;
    } catch (error) {
        console.error('[adminSessionRepository.updateLastActivity] failed:', error.message);
        return null;
    }
};

/**
 * Mark a single session as revoked by its PK.
 * Ownership must be validated by the caller (service layer) before calling this.
 */
const revokeSessionById = async (sessionId) => {
    const session = await AdminSession.findByPk(sessionId);
    if (!session) return null;

    if (!session.is_revoked) {
        session.is_revoked = true;
        await session.save();
    }
    return session;
};

/**
 * Revoke all active sessions for an admin (logout-all / password reset).
 */
const revokeAllSessions = async (adminId) => {
    return AdminSession.update(
        { is_revoked: true },
        { where: { admin_id: adminId, is_revoked: false } }
    );
};

/**
 * Revoke a specific set of sessions by their IDs, scoped to the admin
 * to prevent cross-admin revocation.
 */
const revokeSessionsByIds = async (adminId, sessionIds) => {
    const [affectedCount] = await AdminSession.update(
        { is_revoked: true },
        {
            where: {
                id: sessionIds,
                admin_id: adminId,
                is_revoked: false
            }
        }
    );
    return affectedCount;
};

module.exports = {
    createSession,
    getActiveSessionsByAdmin,
    findSessionByJti,
    findSessionById,
    updateLastActivity,
    revokeSessionById,
    revokeAllSessions,
    revokeSessionsByIds
};
