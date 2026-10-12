'use strict';
const { Admin, AdminActivityLog, AdminPermission, sequelize } = require('../models');
const { Op, QueryTypes } = require('sequelize');
const { ADMIN_STATUS } = require('../utils/constant');

/**
 * Fetch a single admin by id regardless of deletion state.
 * Service layer decides how to handle is_deleted.
 */
const findAdminById = async (adminId) => {
    return await Admin.findOne({
        where: { id: adminId },
        attributes: { exclude: ['password'] }
    });
};

const findAdminByEmail = async (email, excludeId = null) => {
    const where = { email };
    if (excludeId) {
        where.id = { [Op.ne]: excludeId };
    }
    return await Admin.findOne({ where });
};

/**
 * Paginated list of ADMIN-role accounts (excludes SUPER_ADMIN and soft-deleted).
 * Supports optional status and case-insensitive name/email search.
 */
const getAllAdmins = async ({ page = 1, limit = 10, status, search } = {}) => {
    const offset = (page - 1) * limit;

    const where = {
        is_deleted: false,
        role: 'ADMIN'
    };

    if (status) {
        where.is_admin_suspended = status === ADMIN_STATUS.SUSPENDED;
    }

    if (search) {
        where[Op.or] = [
            { name: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } }
        ];
    }

    const { count, rows } = await Admin.findAndCountAll({
        where,
        attributes: { exclude: ['password'] },
        order: [['created_at', 'DESC']],
        limit,
        offset
    });

    return { count, rows };
};

const createAdmin = async (data, options = {}) => {
    return await Admin.create(data, options);
};

const updateAdmin = async (adminId, data, options = {}) => {
    await Admin.update(data, {
        where: { id: adminId },
        ...options
    });
    return await Admin.findOne({
        where: { id: adminId },
        attributes: { exclude: ['password'] },
        transaction: options.transaction || null
    });
};

const logAdminActivity = async (data, options = {}) => {
    return await AdminActivityLog.create(data, options);
};

const getAdminActivityLogs = async (adminId) => {
    return await AdminActivityLog.findAll({
        where: { admin_id: adminId },
        order: [['created_at', 'DESC']],
        include: [
            {
                model: Admin,
                as: 'performedByAdmin',
                attributes: ['id', 'name', 'email', 'role']
            }
        ]
    });
};

/**
 * Every currently-suspended admin, with the reason from their latest
 * admin_suspension_history row. Used once at boot to warm the Redis
 * suspended_admins cache (see adminSuspensionCacheService).
 */
const getSuspendedAdminsWithReason = async () => {
    return await sequelize.query(
        `SELECT
            a.id AS "adminId",
            h.suspension_reason AS "reason",
            h.created_at AS "suspendedAt"
        FROM admin a
        LEFT JOIN LATERAL (
            SELECT suspension_reason, created_at
            FROM admin_suspension_history
            WHERE admin_id = a.id
            ORDER BY created_at DESC
            LIMIT 1
        ) h ON true
        WHERE a.is_admin_suspended IS TRUE AND a.is_deleted IS NOT TRUE`,
        {
            type: QueryTypes.SELECT
        }
    );
};

// ── Admin Permission operations ───────────────────────────────────────────────

const getAdminPermissions = async (adminId) => {
    return await AdminPermission.findAll({
        where: { admin_id: adminId, is_deleted: false },
        attributes: ['id', 'permission_key', 'is_allowed'],
        order: [['created_at', 'ASC']]
    });
};

/**
 * Updates permissions in-place to avoid unique constraint conflicts.
 *
 * Strategy:
 *  - Existing active permission still in incoming list → UPDATE is_allowed in-place
 *  - Existing active permission NOT in incoming list   → soft-delete
 *  - Incoming permission with no existing active row   → INSERT new row
 *
 * This replaces the old soft-delete + bulkCreate pattern which caused a unique
 * constraint violation when re-inserting the same (admin_id, permission_key)
 * on a subsequent update.
 */
const replaceAdminPermissions = async (adminId, permissions, performedBy, options = {}) => {
    const txn = options.transaction;

    // Fetch all currently active permissions for this admin
    const existingPermissions = await AdminPermission.findAll({
        where: { admin_id: adminId, is_deleted: false },
        transaction: txn
    });

    const existingMap = new Map(existingPermissions.map(p => [p.permission_key, p]));
    const incomingKeys = new Set(permissions.map(p => p.permission_key));

    // Update or soft-delete existing permission rows
    for (const existing of existingPermissions) {
        if (incomingKeys.has(existing.permission_key)) {
            // Still in the list — update is_allowed in-place
            const incoming = permissions.find(p => p.permission_key === existing.permission_key);
            await existing.update(
                {
                    is_allowed: incoming.is_allowed,
                    updated_by: performedBy,
                    updated_at: new Date()
                },
                { transaction: txn }
            );
        } else {
            // No longer in the list — soft-delete
            await existing.update(
                {
                    is_deleted: true,
                    deleted_at: new Date(),
                    deleted_by: performedBy
                },
                { transaction: txn }
            );
        }
    }

    // Create rows for permission keys that did not previously exist
    for (const perm of permissions) {
        if (!existingMap.has(perm.permission_key)) {
            await AdminPermission.create(
                {
                    admin_id: adminId,
                    permission_key: perm.permission_key,
                    is_allowed: perm.is_allowed,
                    created_by: performedBy
                },
                { transaction: txn }
            );
        }
    }
};

module.exports = {
    findAdminById,
    findAdminByEmail,
    getAllAdmins,
    createAdmin,
    updateAdmin,
    logAdminActivity,
    getAdminActivityLogs,
    getAdminPermissions,
    replaceAdminPermissions,
    getSuspendedAdminsWithReason
};
