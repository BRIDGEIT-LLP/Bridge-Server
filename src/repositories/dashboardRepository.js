'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');

// ─── User Dashboard ───────────────────────────────────────────────────────────

/**
 * Profile summary row for the user dashboard header — joins user, company,
 * company_user_role and company_role_master to return the signed-in user's
 * display fields in a single query.
 */
const getUserDashboardProfile = async (userId) => {
    const rows = await sequelize.query(
        `SELECT
            u.first_name,
            u.last_name,
            u.organization_name,
            u.is_active,
            c.kyc_status,
            crm.role_code
        FROM "user" u
        JOIN company c
            ON u.company_email = c.company_email
            AND c.is_deleted   IS NOT TRUE
        JOIN company_user_role cur
            ON cur.user_id        = u.id
            AND cur.company_id    = c.id
            AND cur.is_default_role IS TRUE
            AND cur.is_deleted    IS NOT TRUE
        JOIN company_role_master crm ON crm.id = cur.role_id
        WHERE u.id           = :userId
          AND u.is_deleted   IS NOT TRUE
        LIMIT 1`,
        { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return rows[0] || null;
};

/**
 * Connection counts for the user — sent, received, and accepted — in a
 * single aggregate pass to avoid three separate round-trips.
 *
 * Maps to frontend stats:
 *   StartupView  → "Investor Matches" (connectionsReceived) + "Connections" (connectionsAccepted)
 *   InvestorView → "Portfolio Cos."  (connectionsAccepted)
 *   B2BView      → "Marketplace Leads" (connectionsReceived) + "Partners" (connectionsAccepted)
 *
 * FIXED: Added WHERE clause to filter by userId — prevents full-table scan on growing user_connection table.
 */
const getUserConnectionStats = async (userId) => {
    const rows = await sequelize.query(
        `SELECT
            COUNT(*) FILTER (WHERE requester_user_id = :userId)                        AS sent,
            COUNT(*) FILTER (WHERE recipient_user_id  = :userId)                        AS received,
            COUNT(*) FILTER (
                WHERE (requester_user_id = :userId OR recipient_user_id = :userId)
                  AND status = 'Accepted'
            )                                                                           AS accepted
        FROM user_connection
        WHERE (requester_user_id = :userId OR recipient_user_id = :userId)
          AND is_deleted IS NOT TRUE`,
        { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return rows[0] || {};
};

/**
 * Deal rooms the user is a party to that still have status = 'Active'.
 *
 * Maps to:
 *   InvestorView → "New Deals"
 *   B2BView      → "Active Contracts"
 */
const getUserActiveDealRoomsCount = async (userId) => {
    const rows = await sequelize.query(
        `SELECT COUNT(*) AS count
        FROM deal_room
        WHERE (requester_user_id = :userId OR recipient_user_id = :userId)
          AND status     = 'Active'
          AND is_deleted IS NOT TRUE`,
        { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return parseInt(rows[0]?.count || 0);
};

/**
 * Total KYC documents the user has submitted across all document types.
 *
 * Maps to:
 *   StartupView → "Documents"
 *   B2BView     → "Documents"
 */
const getUserKycDocumentsCount = async (userId) => {
    const rows = await sequelize.query(
        `SELECT COUNT(*) AS count
        FROM kyc_info
        WHERE user_id  = :userId
          AND is_deleted IS NOT TRUE`,
        { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return parseInt(rows[0]?.count || 0);
};

/**
 * Future-scheduled meetings the user is a participant in (via their deal rooms).
 * Best-effort — the catch in dashboardService returns 0 silently if the meeting
 * table schema differs from the assumed shape.
 *
 * Maps to:
 *   InvestorView → "Meetings"
 */
const getUserUpcomingMeetingsCount = async (userId) => {
    const rows = await sequelize.query(
        `SELECT COUNT(m.id) AS count
        FROM meeting m
        INNER JOIN deal_room dr
            ON dr.id         = m.deal_room_id
            AND dr.is_deleted IS NOT TRUE
        WHERE (dr.requester_user_id = :userId OR dr.recipient_user_id = :userId)
          AND m.scheduled_at > NOW()
          AND m.is_deleted   IS NOT TRUE`,
        { replacements: { userId }, type: QueryTypes.SELECT }
    );
    return parseInt(rows[0]?.count || 0);
};

// ─── Admin / Super Admin shared ───────────────────────────────────────────────

/**
 * Acting admin's name and role — echoed on the dashboard header so the
 * frontend can personalise the greeting without a separate /me call.
 * Name is not embedded in the JWT payload so a DB fetch is required.
 */
const getAdminProfile = async (adminId) => {
    const rows = await sequelize.query(
        `SELECT name, role
        FROM admin
        WHERE id         = :adminId
          AND is_deleted IS NOT TRUE
        LIMIT 1`,
        { replacements: { adminId }, type: QueryTypes.SELECT }
    );
    return rows[0] || null;
};

/**
 * Aggregate user metrics in one pass:
 *   total           — all profiles with a default company_user_role (real accounts)
 *   suspended       — currently suspended users
 *   new_last_7_days — registrations in the rolling last-7-days window
 *
 * Maps to:
 *   AdminView      → "KYC To Review" context / user management numbers
 *   SuperAdminView → "Total Users"
 */
const getUserCounts = async () => {
    const rows = await sequelize.query(
        `SELECT
            COUNT(DISTINCT cur.user_id)                                                        AS total,
            COUNT(DISTINCT CASE WHEN u.is_user_suspended IS TRUE  THEN cur.user_id END)        AS suspended,
            COUNT(DISTINCT CASE WHEN u.created_at >= NOW() - INTERVAL '7 days'
                                THEN cur.user_id END)                                          AS new_last_7_days
        FROM company_user_role cur
        JOIN "user" u
            ON u.id        = cur.user_id
            AND u.is_deleted IS NOT TRUE
        WHERE cur.is_default_role IS TRUE
          AND cur.is_deleted      IS NOT TRUE`,
        { type: QueryTypes.SELECT }
    );
    return rows[0] || {};
};

/**
 * KYC pipeline counts across all company registrations.
 *
 * Maps to:
 *   AdminView      → "KYC To Review" (pending)
 *   SuperAdminView → "Pending KYC"   (pending)
 */
const getKycStatusCounts = async () => {
    const rows = await sequelize.query(
        `SELECT
            COUNT(*) FILTER (WHERE kyc_status = 'Pending')  AS pending,
            COUNT(*) FILTER (WHERE kyc_status = 'Approved') AS approved,
            COUNT(*) FILTER (WHERE kyc_status = 'Rejected') AS rejected
        FROM company
        WHERE is_deleted IS NOT TRUE`,
        { type: QueryTypes.SELECT }
    );
    return rows[0] || {};
};

// ─── Super Admin only ─────────────────────────────────────────────────────────

/**
 * Total non-deleted company registrations — "Organisations" KPI on the
 * Super Admin dashboard.
 */
const getTotalOrganizationsCount = async () => {
    const rows = await sequelize.query(
        `SELECT COUNT(*) AS count
        FROM company
        WHERE is_deleted IS NOT TRUE`,
        { type: QueryTypes.SELECT }
    );
    return parseInt(rows[0]?.count || 0);
};

/**
 * Distinct users with a session active today (calendar-day boundary, server timezone).
 * Derived from user_session.last_activity_at.
 *
 * IMPORTANT: last_activity_at is only written when SESSION_LIMIT_ENABLED=true
 * (env default: false), and is never written for ADMIN_USER_TYPES sessions at all.
 * In environments where the flag is off, this query will always return 0.
 * Ensure SESSION_LIMIT_ENABLED=true is set in every environment where the
 * "Active Today" KPI is expected to reflect real activity.
 *
 * Maps to SuperAdminView → "Active Today".
 */
const getActiveTodayCount = async () => {
    const rows = await sequelize.query(
        `SELECT COUNT(DISTINCT user_id) AS count
        FROM user_session
        WHERE is_revoked         IS NOT TRUE
          AND last_activity_at >= CURRENT_DATE`,
        { type: QueryTypes.SELECT }
    );
    return parseInt(rows[0]?.count || 0);
};

/**
 * Admin account health — total, active (not suspended), and suspended — used
 * by the Super Admin dashboard to surface staff account status at a glance.
 */
const getAdminAccountCounts = async () => {
    const rows = await sequelize.query(
        `SELECT
            COUNT(*)                                                    AS total,
            COUNT(*) FILTER (WHERE is_admin_suspended IS NOT TRUE)     AS active,
            COUNT(*) FILTER (WHERE is_admin_suspended IS TRUE)         AS suspended
        FROM admin
        WHERE is_deleted IS NOT TRUE`,
        { type: QueryTypes.SELECT }
    );
    return rows[0] || {};
};

module.exports = {
    // ── User ──────────────────────────────────────────────────────────────────
    getUserDashboardProfile,
    getUserConnectionStats,
    getUserActiveDealRoomsCount,
    getUserKycDocumentsCount,
    getUserUpcomingMeetingsCount,
    // ── Admin / Super Admin shared ────────────────────────────────────────────
    getAdminProfile,
    getUserCounts,
    getKycStatusCounts,
    // ── Super Admin only ──────────────────────────────────────────────────────
    getTotalOrganizationsCount,
    getActiveTodayCount,
    getAdminAccountCounts,
};