'use strict';

const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { CONNECTION_STATUS, KYC_STATUS } = require('../utils/constant');

/**
 * Fetches a user profile with their assigned role (via company_user_role join).
 * Returns the full user row plus role_code from company_role_master.
 */
const getProfileWithRole = async (userId) => {
    const results = await sequelize.query(
        `SELECT
            u.*,
            crm.role_code,
            crm.role_name,
            c.company_name,
            c.id AS company_id
        FROM "user" u
        JOIN company_user_role cur ON cur.user_id = u.id
        JOIN company_role_master crm ON crm.id = cur.role_id
        JOIN company c ON c.id = cur.company_id
        WHERE u.id = :userId
          AND u.is_deleted IS NOT TRUE
          AND cur.is_default_role IS TRUE
          AND c.is_deleted IS NOT TRUE
        LIMIT 1`,
        {
            replacements: { userId },
            type: QueryTypes.SELECT
        }
    );
    return results.length > 0 ? results[0] : null;
};

/**
 * Fetches all active, non-deleted user profiles with their roles,
 * excluding the given userId (the source profile) and any candidate
 * user+role combination the source user already has an Accepted or
 * Deferred connection with, regardless of which of the source user's
 * own roles that connection was made under.
 */
const getCandidateProfiles = async (excludeUserId) => {
    return await sequelize.query(
        `SELECT
            u.*,
            cur.role_id,
            crm.role_code,
            crm.role_name,
            c.company_name,
            c.id AS company_id
        FROM "user" u
        JOIN company_user_role cur ON cur.user_id = u.id
        JOIN company_role_master crm ON crm.id = cur.role_id
        JOIN company c ON c.id = cur.company_id
        WHERE u.id != :excludeUserId
          AND u.is_deleted IS NOT TRUE
          AND u.is_active IS TRUE
          AND cur.is_deleted IS NOT TRUE
          AND (
              cur.is_default_role IS TRUE
              OR cur.status = :approvedStatus
          )
          AND c.is_deleted IS NOT TRUE
          AND c.is_email_verified IS TRUE
          AND c.is_mobile_number_verified IS TRUE
          AND c.is_kyc_verified IS TRUE
          AND c.kyc_status = :approvedStatus
          AND NOT EXISTS (
              SELECT 1 FROM user_connection uc
              WHERE uc.is_deleted IS NOT TRUE
                AND uc.status IN (:excludedStatuses)
                AND (
                    (uc.requester_user_id = :excludeUserId AND uc.recipient_user_id = u.id AND uc.recipient_role_id = cur.role_id)
                    OR (uc.recipient_user_id = :excludeUserId AND uc.requester_user_id = u.id AND uc.requester_role_id = cur.role_id)
                )
          )`,
        {
            replacements: {
                excludeUserId,
                approvedStatus: KYC_STATUS.APPROVED,
                excludedStatuses: [CONNECTION_STATUS.ACCEPTED, CONNECTION_STATUS.DEFERRED, CONNECTION_STATUS.PENDING, CONNECTION_STATUS.VIEWED]
            },
            type: QueryTypes.SELECT
        }
    );
};

module.exports = {
    getProfileWithRole,
    getCandidateProfiles
};
