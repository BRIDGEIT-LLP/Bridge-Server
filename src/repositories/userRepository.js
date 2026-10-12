'use strict';
const { User, UserProfileFieldMaster, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { CONNECTION_BLOCKING_STATUSES, KYC_STATUS, KYC_DOC_TYPES } = require('../utils/constant');

/**
 * Columns a self-service profile request must never write. Identity, secrets,
 * account lifecycle, and audit fields are admin/system-owned — `User.rawAttributes`
 * includes them, so an "is it a real column?" copy would otherwise persist
 * `{ is_user_suspended: false }` from PUT /users/profile.
 */
const NEVER_SELF_WRITABLE = new Set([
    'id',
    'password',
    'company_email',
    'is_active',
    'is_user_suspended',
    'created_at',
    'created_by',
    'updated_at',
    'updated_by',
    'deleted_at',
    'deleted_by',
    'is_deleted'
]);

/** Admin-only lifecycle flags. Writable only when `allowPrivileged: true`. */
const ADMIN_ONLY_COLUMNS = new Set(['is_active', 'is_user_suspended']);

/**
 * `user` columns configured in `user_profile_field_master` (any role). That is the
 * self-service allowlist — switch-role PUTs target-role fields while the JWT is
 * still the current role, so this is the union across roles, not one role's list.
 */
const getSelfServiceUserColumnNames = async () => {
    const rows = await UserProfileFieldMaster.findAll({
        where: { source_table: 'user', is_deleted: false },
        attributes: ['field_name', 'lookup']
    });
    const allowed = new Set();
    for (const raw of rows) {
        const f = typeof raw.get === 'function' ? raw.get({ plain: true }) : raw;
        const name = f.lookup || f.field_name;
        if (name && !NEVER_SELF_WRITABLE.has(name)) allowed.add(name);
    }
    return allowed;
};

const createUser = async (userData, transaction) => {
    return await User.create(userData, transaction);
};

const updateUser = async (userData, userId, { transaction, allowPrivileged = false } = {}) => {
    // company_email is the verified account identity set at registration (OTP-verified,
    // unique-constrained) — never writable through a profile update. Without this,
    // a stray company_email in the payload (the client always includes it as a locked/
    // read-only field) can collide with another row's email and fail the whole update
    // with a SequelizeUniqueConstraintError, rolling back every other field in the same
    // request even though none of them were the actual problem.
    //
    // Self-service (build-profile / PUT /users/profile): copy only columns that are
    // both a real `user` attribute AND listed in user_profile_field_master, minus
    // NEVER_SELF_WRITABLE. Privileged callers (admin suspension) pass allowPrivileged
    // so `is_user_suspended` / `is_active` can be written without opening those keys
    // on the user profile endpoint.
    const attributes = User.rawAttributes || {};
    const skip = new Set(NEVER_SELF_WRITABLE);
    if (allowPrivileged) {
        for (const col of ADMIN_ONLY_COLUMNS) skip.delete(col);
    }
    const allowed = allowPrivileged ? null : await getSelfServiceUserColumnNames();

    const safeUserData = {};
    for (const [key, value] of Object.entries(userData || {})) {
        if (skip.has(key) || !attributes[key]) continue;
        if (allowed && !allowed.has(key)) continue;
        safeUserData[key] = value;
    }
    const [updatedCount, updatedRows] = await User.update(
        {
            ...safeUserData,
            updated_at: new Date()
        },
        {
            where: {
                id: userId,
                is_deleted: false
            },
            fields: [...Object.keys(safeUserData), 'updated_at'],
            returning: true, // PostgreSQL only
            transaction
        }
    );

    if (updatedCount === 0) {
        throw new Error(`User not found with id ${userId}`);
    }

    return updatedRows[0];
};

const findByEmail = async (email) => {
    return await User.findOne({
        where: { company_email: email }
    });
} 


const getCompanyUser_role = async (companyId, userId) => {
    return await sequelize.query(
        `select crm.id, crm.role_name, crm.role_code, crm.role_description
        from company_user_role cur
        join company_role_master crm on cur.role_id = crm.id
        where cur.company_id = :companyId
        and cur.user_id = :userId`,
        {
            replacements: { userId, companyId },
            type: QueryTypes.SELECT
        }
    );
};

const getUserList = async () => {
    return await sequelize.query(
        `select 
            u.id as user_id,
            u.first_name, 
            u.last_name, 
            u.profile_photo,
            c.id as company_id,
            c.company_email, 
            c.company_name, 
            c.country_code, 
            c.mobile_number, 
            c.is_email_verified, 
            c.is_mobile_number_verified, 
            c.kyc_status,
            EXISTS (
                SELECT 1
                FROM kyc_info k
                WHERE k.user_id = u.id
                    AND k.is_deleted IS NOT TRUE
                    AND k.document_type IN (:kycDocTypes)
            ) AS has_kyc_documents,
            u.is_active,
            u.is_user_suspended,
            (select crm.role_code from company_role_master crm where id = cur.role_id) as role
        from "user" u 
        join company c on u.company_email = c.company_email 
        join company_user_role cur on cur.company_id = c.id and cur.user_id = u.id
        where u.is_deleted is not true and c.is_deleted is not true and cur.is_default_role is true`,
        {
            replacements: { kycDocTypes: KYC_DOC_TYPES },
            type: QueryTypes.SELECT
        }
    );
};

        // Users with more than one active company_user_role row have used the
        // switch-role flow (request-role-switch) to add a role beyond their
        // original default one.
const getUsersWithSwitchedRoles = async () => {
    return await sequelize.query(
        `SELECT user_id, first_name, last_name, profile_photo, company_id, company_email, company_name,
            company_user_role_id, role_id, role_code, role_name, is_default_role,
            status, is_profile_completed, rejection_reason, switched_at, approved_at
        FROM (
            SELECT
                u.id AS user_id,
                u.first_name,
                u.last_name,
                u.profile_photo,
                c.id AS company_id,
                c.company_email,
                c.company_name,
                cur.id AS company_user_role_id,
                crm.id AS role_id,
                crm.role_code,
                crm.role_name,
                cur.is_default_role,
                cur.status,
                cur.is_profile_completed,
                cur.rejection_reason,
                cur.created_at AS switched_at,
                cur.approved_at,
                COUNT(*) OVER (PARTITION BY u.id) AS role_count
            FROM "user" u
            JOIN company c ON c.company_email = u.company_email
            JOIN company_user_role cur ON cur.company_id = c.id AND cur.user_id = u.id AND cur.is_deleted IS NOT TRUE
            JOIN company_role_master crm ON crm.id = cur.role_id
            WHERE u.is_deleted IS NOT TRUE AND c.is_deleted IS NOT TRUE
        ) sub
        WHERE role_count > 1
        ORDER BY user_id, switched_at`,
        {
            type: QueryTypes.SELECT
        }
    );
};

const getSuspendedUsersWithRoleAndCompany = async () => {
    return await sequelize.query(
        `SELECT
            u.id AS "userId",
            c.id AS "companyId",
            cur.role_id AS "roleId",
            crm.role_code AS "role",
            h.suspension_reason AS "reason",
            h.created_at AS "suspendedAt"
        FROM "user" u
        JOIN company_user_role cur ON cur.user_id = u.id AND cur.is_default_role IS TRUE AND cur.is_deleted IS NOT TRUE
        JOIN company_role_master crm ON crm.id = cur.role_id
        JOIN company c ON c.id = cur.company_id
        LEFT JOIN LATERAL (
            SELECT suspension_reason, created_at
            FROM user_suspension_history
            WHERE user_id = u.id
            ORDER BY created_at DESC
            LIMIT 1
        ) h ON true
        WHERE u.is_user_suspended IS TRUE AND u.is_deleted IS NOT TRUE`,
        {
            type: QueryTypes.SELECT
        }
    );
};

const getUserKycDocs = async () => {
    return await sequelize.query(
        `SELECT
            u.id AS uid,
            c.id AS cid,
            u.first_name,
            u.last_name,
            u.profile_photo,
            c.company_email,
            c.company_name,
            c.country_code,
            c.mobile_number,
            c.is_email_verified,
            c.is_mobile_number_verified,
            c.kyc_status,
            c.is_kyc_verified,
            c.kyc_rejection_reason,
            k.id AS kyc_id,
            k.document_type,
            k.document_number,
            k.document_number_iv,
            k.document_number_auth_tag,
            k.front_s3_key,
            k.front_file_name,
            k.back_s3_key,
            k.back_file_name,
            k.status AS document_status,
            k.rejection_reason,
            k.verified_at,
            k.created_at AS kyc_uploaded_at
        FROM "user" u
        JOIN company c ON u.company_email = c.company_email
        LEFT JOIN LATERAL (
            SELECT DISTINCT ON (k.document_type)
                k.id,
                k.document_type,
                k.document_number,
                k.document_number_iv,
                k.document_number_auth_tag,
                k.front_s3_key,
                k.front_file_name,
                k.back_s3_key,
                k.back_file_name,
                k.status,
                k.rejection_reason,
                k.verified_at,
                k.created_at
            FROM kyc_info k
            WHERE k.user_id = u.id
                AND k.is_deleted IS NOT TRUE
                AND k.document_type IN (:kycDocTypes)
            ORDER BY k.document_type, k.created_at DESC, k.id DESC
        ) k ON TRUE
        WHERE u.is_deleted IS NOT TRUE
        ORDER BY k.created_at DESC`,
        {
            replacements: { kycDocTypes: KYC_DOC_TYPES },
            type: QueryTypes.SELECT
        }
    );
};

const searchUsers = async (searchQuery, searchableRoles = [], excludeUserId, viewerUserId, viewerRoleId) => {
    const words = [...new Set(searchQuery.trim().split(/\s+/).filter(Boolean))];

    const replacements = {};
    const wordConditions = words.map((word, index) => {
        const key = `word${index}`;
        replacements[key] = `%${word.replace(/[%_\\]/g, '\\$&')}%`;
        return `(c.company_email ILIKE :${key} ESCAPE '\\' OR u.first_name ILIKE :${key} ESCAPE '\\' OR u.last_name ILIKE :${key} ESCAPE '\\' OR c.company_name ILIKE :${key} ESCAPE '\\')`;
    }).join(' OR ');

    let roleFilter = '';
    if (Array.isArray(searchableRoles) && searchableRoles.length > 0) {
        replacements.searchableRoles = searchableRoles;
        roleFilter = 'AND crm.role_code IN (:searchableRoles)';
    }

    let excludeFilter = '';
    if (excludeUserId) {
        replacements.excludeUserId = excludeUserId;
        excludeFilter = 'AND u.id <> :excludeUserId';
    }

    replacements.approvedStatus = KYC_STATUS.APPROVED;
    replacements.kycDocTypes = KYC_DOC_TYPES;
    replacements.kycDocTypeCount = KYC_DOC_TYPES.length;

    const hasViewer = Boolean(viewerUserId && viewerRoleId);
    let connectionSelect = 'NULL AS connection_status';
    let connectionJoin = '';
    if (hasViewer) {
        replacements.viewerUserId = viewerUserId;
        replacements.viewerRoleId = viewerRoleId;
        replacements.blockingStatuses = CONNECTION_BLOCKING_STATUSES;
        connectionSelect = 'conn.status AS connection_status';
        connectionJoin = `LEFT JOIN LATERAL (
            SELECT uc.status
            FROM user_connection uc
            WHERE uc.is_deleted IS NOT TRUE
              AND uc.status IN (:blockingStatuses)
              AND (
                  (uc.requester_user_id = :viewerUserId AND uc.requester_role_id = :viewerRoleId
                   AND uc.recipient_user_id = u.id AND uc.recipient_role_id = cur.role_id)
                  OR
                  (uc.requester_user_id = u.id AND uc.requester_role_id = cur.role_id
                   AND uc.recipient_user_id = :viewerUserId AND uc.recipient_role_id = :viewerRoleId)
              )
            ORDER BY uc.updated_at DESC NULLS LAST, uc.created_at DESC
            LIMIT 1
        ) conn ON TRUE`;
    }

    return await sequelize.query(
        `SELECT
            u.id AS user_id,
            cur.role_id,
            crm.role_code AS role,
            crm.role_name,
            c.id AS company_id,
            u.first_name,
            u.last_name,
            u.profile_photo,
            c.company_name,
            c.company_email AS email,
            c.mobile_number,
            u.country,
            u.continent,
            ${connectionSelect}
        FROM "user" u
        JOIN company c ON u.company_email = c.company_email
        JOIN company_user_role cur ON cur.company_id = c.id AND cur.user_id = u.id AND cur.is_default_role IS TRUE
        JOIN company_role_master crm ON crm.id = cur.role_id
        ${connectionJoin}
        WHERE u.is_deleted IS NOT TRUE
            AND c.is_deleted IS NOT TRUE
            AND cur.is_deleted IS NOT TRUE
            AND cur.is_profile_completed IS TRUE
            AND c.is_kyc_verified IS TRUE
            AND c.kyc_status = :approvedStatus
            AND (
                SELECT COUNT(DISTINCT k.document_type)
                FROM kyc_info k
                WHERE k.user_id = u.id
                    AND k.company_id = c.id
                    AND k.role_id = cur.role_id
                    AND k.is_deleted IS NOT TRUE
                    AND k.status = :approvedStatus
                    AND k.document_type IN (:kycDocTypes)
            ) = :kycDocTypeCount
            AND (${wordConditions})
            ${roleFilter}
            ${excludeFilter}
        ORDER BY u.first_name ASC`,
        {
            replacements,
            type: QueryTypes.SELECT
        }
    );
};

const getUserById = async (userId) => {
    return await User.findOne({
        where: { id: userId, is_deleted: false }
    });
};

const getUserCompanyRole = async (userId, companyId, roleId) => {
    const rows = await sequelize.query(
        `SELECT cur.role_id, cur.company_id, crm.role_name, crm.role_code
        FROM company_user_role cur
        JOIN company_role_master crm ON crm.id = cur.role_id
        WHERE cur.user_id = :userId
            AND cur.company_id = :companyId
            AND cur.role_id = :roleId
            AND cur.is_deleted IS NOT TRUE
        LIMIT 1`,
        {
            replacements: { userId, companyId, roleId },
            type: QueryTypes.SELECT
        }
    );
    return rows[0] || null;
};

const getUserCompanyRoleByCode = async (userId, companyId, roleCode) => {
    const rows = await sequelize.query(
        `SELECT cur.id AS company_user_role_id, cur.role_id, cur.company_id, cur.status,
            cur.rejection_reason, cur.is_profile_completed, crm.role_name, crm.role_code
        FROM company_user_role cur
        JOIN company_role_master crm ON crm.id = cur.role_id
        WHERE cur.user_id = :userId
            AND cur.company_id = :companyId
            AND crm.role_code = :roleCode
            AND cur.is_deleted IS NOT TRUE
        LIMIT 1`,
        {
            replacements: { userId, companyId, roleCode },
            type: QueryTypes.SELECT
        }
    );
    return rows[0] || null;
};

const updatePasswordByEmail = async (email, hashedPassword, { transaction } = {}) => {
    const [, [updatedUser]] = await User.update(
        { password: hashedPassword },
        { where: { company_email: email, is_deleted: false }, transaction, returning: true }
    );
    return updatedUser;
};

const getUserProfileFieldsConfig = async (roleId) => {
    return await UserProfileFieldMaster.findAll({
        where: { role_id: roleId, is_deleted: false },
        order: [['display_order', 'ASC'], ['field_name', 'ASC']]
    });
};

module.exports = {
    createUser,
    updateUser,
    findByEmail,
    getCompanyUser_role,
    getUserList,
    getUsersWithSwitchedRoles,
    getSuspendedUsersWithRoleAndCompany,
    getUserKycDocs,
    searchUsers,
    getUserById,
    getUserCompanyRole,
    getUserCompanyRoleByCode,
    getUserProfileFieldsConfig,
    updatePasswordByEmail
};
