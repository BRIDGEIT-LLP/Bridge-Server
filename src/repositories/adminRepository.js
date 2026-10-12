'use strict';
const { Admin, sequelize } = require('../models');

const findByEmail = async (email) => {
    return await Admin.findOne({
        where: { email, is_deleted: false }
    });
};

/**
 * Find an admin by their UUID, excluding soft-deleted accounts and the password field.
 */
const findAdminById = async (adminId) => {
    try {
        const admin = await Admin.findByPk(adminId, {
            attributes: { exclude: ['password'] },
            where: { is_deleted: false }
        });
        return admin;
    } catch (err) {
        throw err;
    }
};

/**
 * Partial update of an admin by UUID. Automatically sets updated_at timestamp.
 */
const updateAdminById = async (adminId, data) => {
    try {
        const updateData = {
            ...data,
            updated_at: new Date(),
            updated_by: adminId // The admin updating their own profile
        };
        
        const [count] = await Admin.update(updateData, {
            where: { id: adminId, is_deleted: false }
        });
        
        return count > 0;
    } catch (err) {
        throw err;
    }
};

/**
 * Three raw queries for the Matching Engine Dashboard KPIs.
 * Kept in the repository layer so the service stays business-logic only.
 */
const getMatchingEngineKpis = async () => {
    const [rows] = await sequelize.query(`
        SELECT
            (SELECT COUNT(DISTINCT cur.user_id)
             FROM company_user_role cur
             WHERE cur.is_default_role IS TRUE) AS total_profiles,

            (SELECT COUNT(*)
             FROM user_connection
             WHERE is_deleted IS NOT TRUE) AS total_connections,

            (SELECT COUNT(*)
             FROM user_connection
             WHERE is_deleted IS NOT TRUE AND status = 'Accepted') AS accepted_connections,

            (SELECT COUNT(*)
             FROM deal_room
             WHERE is_deleted IS NOT TRUE AND status = 'Active') AS active_deal_rooms
    `);
    return rows[0] || {};
};

const getConnectionStatusBreakdown = async () => {
    const [rows] = await sequelize.query(`
        SELECT status, COUNT(*) AS count
        FROM user_connection
        WHERE is_deleted IS NOT TRUE
        GROUP BY status
        ORDER BY count DESC
    `);
    return rows;
};

const getZeroEngagementProfiles = async () => {
    const [rows] = await sequelize.query(`
        SELECT
            u.id AS user_id,
            u.first_name,
            u.last_name,
            u.profile_photo,
            u.created_at,
            crm.role_code,
            c.company_name
        FROM "user" u
        JOIN company c
            ON u.company_email = c.company_email
            AND c.is_deleted IS NOT TRUE
        JOIN company_user_role cur
            ON cur.company_id = c.id
            AND cur.user_id   = u.id
            AND cur.is_default_role IS TRUE
        JOIN company_role_master crm
            ON crm.id = cur.role_id
        WHERE u.is_deleted IS NOT TRUE
          AND u.id NOT IN (
              SELECT requester_user_id FROM user_connection WHERE is_deleted IS NOT TRUE
              UNION
              SELECT recipient_user_id FROM user_connection WHERE is_deleted IS NOT TRUE
          )
        ORDER BY u.created_at DESC
        LIMIT 100
    `);
    return rows;
};

// ─── Matching Events Stats (FRD Module 12.3 — requires matching_events table) ─

/** Total matches shown to users: today / this week / this month */
const getMatchesGenerated = async () => {
    const [rows] = await sequelize.query(`
        SELECT
            COUNT(*) FILTER (WHERE action = 'shown' AND created_at >= CURRENT_DATE) AS today,
            COUNT(*) FILTER (WHERE action = 'shown' AND created_at >= DATE_TRUNC('week',  NOW())) AS this_week,
            COUNT(*) FILTER (WHERE action = 'shown' AND created_at >= DATE_TRUNC('month', NOW())) AS this_month
        FROM matching_events
        WHERE is_deleted IS NOT TRUE
    `);
    return rows[0] || {};
};

/** Average compatibility score across all shown matches */
const getAverageCompatibilityScore = async () => {
    const [rows] = await sequelize.query(`
        SELECT ROUND(AVG(compatibility_score)::NUMERIC, 1) AS avg_score
        FROM matching_events
        WHERE is_deleted IS NOT TRUE
          AND action = 'shown'
          AND compatibility_score IS NOT NULL
    `);
    return rows[0] || {};
};

/** Top 5 sectors by match volume (for sector mix analytics) */
const getTopSectorsByVolume = async () => {
    const [rows] = await sequelize.query(`
        SELECT match_sector AS sector, COUNT(*) AS count
        FROM matching_events
        WHERE is_deleted IS NOT TRUE
          AND action = 'shown'
          AND match_sector IS NOT NULL
        GROUP BY match_sector
        ORDER BY count DESC
        LIMIT 5
    `);
    return rows;
};

/** Rule-based vs. ML match ratio (cold-start vs. trained model) */
const getAlgorithmDistribution = async () => {
    const [rows] = await sequelize.query(`
        SELECT algorithm_type, COUNT(*) AS count
        FROM matching_events
        WHERE is_deleted IS NOT TRUE
          AND action = 'shown'
        GROUP BY algorithm_type
        ORDER BY count DESC
    `);
    return rows;
};

/** Behavioural signal breakdown — accepts, skips, flags etc. (excludes 'shown') */
const getBehavioralSignals = async () => {
    const [rows] = await sequelize.query(`
        SELECT action, COUNT(*) AS count
        FROM matching_events
        WHERE is_deleted IS NOT TRUE
          AND action != 'shown'
        GROUP BY action
        ORDER BY count DESC
    `);
    return rows;
};

module.exports = { 
    findByEmail, 
    getMatchingEngineKpis, 
    getConnectionStatusBreakdown, 
    getZeroEngagementProfiles, 
    getMatchesGenerated, 
    getAverageCompatibilityScore, 
    getTopSectorsByVolume, 
    getAlgorithmDistribution, 
    getBehavioralSignals,
    findAdminById,
    updateAdminById
};
