'use strict';
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { KYC_STATUS } = require('../utils/constant');

// Shared projection for both the list and the detail query (admin Verification queue,
// FRD §12.5). company <-> user is matched by email, same as userRepository.getUserKycDocs
// — this codebase has no direct company.user_id column.
const SELECT_COLUMNS = `
    c.id AS company_id,
    u.id AS user_id,
    cur.role_id,
    u.first_name,
    u.last_name,
    u.profile_photo,
    u.city,
    c.company_name,
    c.company_email,
    c.gst_number,
    c.gst_number_iv,
    c.gst_number_auth_tag,
    c.cin_number,
    c.cin_number_iv,
    c.cin_number_auth_tag,
    crm.role_code,
    c.created_at AS submitted_at,
    c.gst_verification_status,
    c.mca_verification_status,
    cur.pan_verification_status,
    c.name_match_status,
    c.name_match_note,
    cur.vouched_by_name,
    c.kyc_rejection_count,
    u.funding_stage,
    u.funding_ask_amt_min,
    u.funding_ask_amt_max,
    u.funding_currency,
    u.ticket_size_amt_min,
    u.ticket_size_amt_max,
    u.ticket_currency,
    u.revenue_band
`;

const FROM_JOINS = `
    FROM "user" u
    JOIN company c ON u.company_email = c.company_email
    LEFT JOIN company_user_role cur ON cur.user_id = u.id AND cur.company_id = c.id AND cur.is_deleted IS NOT TRUE AND cur.is_default_role IS TRUE
    LEFT JOIN company_role_master crm ON crm.id = cur.role_id
`;

// Oldest first (FRD §12.5) — only applicants still awaiting a decision belong in the queue.
const getVerificationQueueList = async () => {
    return await sequelize.query(
        `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
         WHERE u.is_deleted IS NOT TRUE AND c.kyc_status = :kycStatus
         ORDER BY c.created_at ASC`,
        {
            replacements: { kycStatus: KYC_STATUS.PENDING },
            type: QueryTypes.SELECT
        }
    );
};

const getVerificationQueueDetail = async (companyId) => {
    const rows = await sequelize.query(
        `SELECT ${SELECT_COLUMNS} ${FROM_JOINS}
         WHERE u.is_deleted IS NOT TRUE AND c.id = :companyId
         LIMIT 1`,
        {
            replacements: { companyId },
            type: QueryTypes.SELECT
        }
    );
    return rows[0] ?? null;
};

module.exports = { getVerificationQueueList, getVerificationQueueDetail };
