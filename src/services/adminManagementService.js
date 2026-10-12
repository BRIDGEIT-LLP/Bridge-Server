'use strict';
const bcrypt = require('bcrypt');
const adminManagementRepository = require('../repositories/adminManagementRepository');
const adminSuspensionHistoryRepository = require('../repositories/adminSuspensionHistoryRepository');
const adminSuspensionCacheRepository = require('../repositories/adminSuspensionCacheRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { ADMIN_MANAGEMENT_MESSAGES, ADMIN_ACTIVITY_ACTIONS, ADMIN_ROLES_CODE } = require('../utils/constant');
const { sequelize } = require('../models');

const SALT_ROUNDS = 10;

const getAdminList = async ({ page, limit, status, search }) => {
    try {
        const { count, rows } = await adminManagementRepository.getAllAdmins({ page, limit, status, search });

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.LIST_SUCCESS,
            data: {
                admins: rows,
                pagination: {
                    total: count,
                    page,
                    limit,
                    totalPages: Math.ceil(count / limit)
                }
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.LIST_FAILED,
            statusCode: 500
        });
    }
};

const getAdminDetail = async (adminId) => {
    try {
        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin) {
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        const [activityLogs, permissions] = await Promise.all([
            adminManagementRepository.getAdminActivityLogs(adminId),
            adminManagementRepository.getAdminPermissions(adminId)
        ]);

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.DETAIL_SUCCESS,
            data: { admin, permissions, activityLogs },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.DETAIL_FAILED,
            statusCode: 500
        });
    }
};

const createAdmin = async ({ name, email, password, country_code, mobile_number, role, permissions = [], performedBy }) => {
    const transaction = await sequelize.transaction();
    try {
        const existingAdmin = await adminManagementRepository.findAdminByEmail(email);
        if (existingAdmin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.EMAIL_ALREADY_EXISTS,
                statusCode: 409
            });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const admin = await adminManagementRepository.createAdmin({
            name,
            email,
            password: hashedPassword,
            country_code: country_code || null,
            mobile_number: mobile_number || null,
            role: ADMIN_ROLES_CODE.ADMIN,
            is_admin_suspended: false,
            created_by: performedBy
        }, { transaction });

        if (permissions.length > 0) {
            await adminManagementRepository.replaceAdminPermissions(admin.id, permissions, performedBy, { transaction });
        }

        await adminManagementRepository.logAdminActivity({
            admin_id: admin.id,
            performed_by: performedBy,
            action: ADMIN_ACTIVITY_ACTIONS.CREATED,
            reason: null,
            metadata: {
                name,
                email,
                role: ADMIN_ROLES_CODE.ADMIN,
                permissions: permissions.map(p => ({ permission_key: p.permission_key, is_allowed: p.is_allowed }))
            }
        }, { transaction });

        await transaction.commit();

        const adminData = admin.toJSON();
        delete adminData.password;

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.CREATE_SUCCESS,
            data: adminData,
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.CREATE_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Updates profile fields and/or permissions in a single transaction.
 * Both are optional individually — but at least one must be present
 * (enforced by Joi validation before this is called).
 *
 * Logs separate activity entries for profile changes and permission changes
 * so the audit trail stays granular.
 */
const updateAdmin = async ({ adminId, payload, performedBy }) => {
    const transaction = await sequelize.transaction();
    try {
        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        if (admin.is_deleted) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_ACTION_DELETED,
                statusCode: 409
            });
        }

        if (admin.role !== ADMIN_ROLES_CODE.ADMIN) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.INVALID_ROLE,
                statusCode: 403
            });
        }

        const { permissions, ...profilePayload } = payload;

        // ── 1. Update profile fields if any were sent ─────────────────────────
        const profileFields = ['name', 'country_code', 'mobile_number'];
        const sentProfileFields = profileFields.filter(f => profilePayload[f] !== undefined);

        let updatedAdmin = admin;
        if (sentProfileFields.length > 0) {
            const updateData = { updated_by: performedBy, updated_at: new Date() };
            sentProfileFields.forEach(f => { updateData[f] = profilePayload[f]; });

            updatedAdmin = await adminManagementRepository.updateAdmin(adminId, updateData, { transaction });

            await adminManagementRepository.logAdminActivity({
                admin_id: adminId,
                performed_by: performedBy,
                action: ADMIN_ACTIVITY_ACTIONS.UPDATED,
                reason: null,
                metadata: { updatedFields: sentProfileFields }
            }, { transaction });
        }

        // ── 2. Replace permissions if they were sent ──────────────────────────
        if (permissions !== undefined) {
            await adminManagementRepository.replaceAdminPermissions(adminId, permissions, performedBy, { transaction });

            await adminManagementRepository.logAdminActivity({
                admin_id: adminId,
                performed_by: performedBy,
                action: ADMIN_ACTIVITY_ACTIONS.PERMISSIONS_UPDATED,
                reason: null,
                metadata: {
                    permissions: permissions.map(p => ({ permission_key: p.permission_key, is_allowed: p.is_allowed }))
                }
            }, { transaction });
        }

        await transaction.commit();

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.UPDATE_SUCCESS,
            data: updatedAdmin,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

const deleteAdmin = async ({ adminId, reason, performedBy }) => {
    const transaction = await sequelize.transaction();
    try {
        if (adminId === performedBy) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_SELF_ACTION,
                statusCode: 400
            });
        }

        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        if (admin.is_deleted) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.ALREADY_DELETED,
                statusCode: 409
            });
        }

        if (admin.role !== ADMIN_ROLES_CODE.ADMIN) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.INVALID_ROLE,
                statusCode: 403
            });
        }

        await adminManagementRepository.updateAdmin(adminId, {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: performedBy,
            updated_by: performedBy,
            updated_at: new Date()
        }, { transaction });

        await adminManagementRepository.logAdminActivity({
            admin_id: adminId,
            performed_by: performedBy,
            action: ADMIN_ACTIVITY_ACTIONS.DELETED,
            reason,
            metadata: { adminEmail: admin.email, adminName: admin.name }
        }, { transaction });

        await transaction.commit();

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.DELETE_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.DELETE_FAILED,
            statusCode: 500
        });
    }
};

const suspendAdmin = async ({ adminId, reason, performedBy }) => {
    const transaction = await sequelize.transaction();
    try {
        if (adminId === performedBy) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_SELF_ACTION,
                statusCode: 400
            });
        }

        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        if (admin.is_deleted) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_ACTION_DELETED,
                statusCode: 409
            });
        }

        if (admin.role !== ADMIN_ROLES_CODE.ADMIN) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.INVALID_ROLE,
                statusCode: 403
            });
        }

        if (admin.is_admin_suspended) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.ALREADY_SUSPENDED,
                statusCode: 409
            });
        }

        await adminManagementRepository.updateAdmin(adminId, {
            is_admin_suspended: true,
            updated_by: performedBy,
            updated_at: new Date()
        }, { transaction });

        await adminManagementRepository.logAdminActivity({
            admin_id: adminId,
            performed_by: performedBy,
            action: ADMIN_ACTIVITY_ACTIONS.SUSPENDED,
            reason,
            metadata: { adminEmail: admin.email, adminName: admin.name }
        }, { transaction });

        const history = await adminSuspensionHistoryRepository.create({
            admin_id: adminId,
            is_suspended: true,
            suspension_reason: reason,
            created_by: performedBy
        }, { transaction });

        await transaction.commit();

        // Keep the Redis suspension cache in sync so adminMiddleware's
        // per-request suspension check reflects this change on the very
        // next authenticated request, without waiting for the next app
        // restart. Best-effort: Postgres already committed and is the
        // source of truth, so a Redis hiccup here must not fail the
        // admin's request — worst case it self-heals on the next startup load.
        await adminSuspensionCacheRepository.cacheSuspension(adminId, {
            reason,
            suspendedAt: history.created_at
        });

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.SUSPEND_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.SUSPEND_FAILED,
            statusCode: 500
        });
    }
};

const activateAdmin = async ({ adminId, reason, performedBy }) => {
    const transaction = await sequelize.transaction();
    try {
        if (adminId === performedBy) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_SELF_ACTION,
                statusCode: 400
            });
        }

        const admin = await adminManagementRepository.findAdminById(adminId);
        if (!admin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        if (admin.is_deleted) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.CANNOT_ACTION_DELETED,
                statusCode: 409
            });
        }

        if (admin.role !== ADMIN_ROLES_CODE.ADMIN) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.INVALID_ROLE,
                statusCode: 403
            });
        }

        if (!admin.is_admin_suspended) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: ADMIN_MANAGEMENT_MESSAGES.ALREADY_ACTIVE,
                statusCode: 409
            });
        }

        await adminManagementRepository.updateAdmin(adminId, {
            is_admin_suspended: false,
            updated_by: performedBy,
            updated_at: new Date()
        }, { transaction });

        await adminManagementRepository.logAdminActivity({
            admin_id: adminId,
            performed_by: performedBy,
            action: ADMIN_ACTIVITY_ACTIONS.ACTIVATED,
            reason,
            metadata: { adminEmail: admin.email, adminName: admin.name }
        }, { transaction });

        await adminSuspensionHistoryRepository.create({
            admin_id: adminId,
            is_suspended: false,
            suspension_reason: reason,
            created_by: performedBy
        }, { transaction });

        await transaction.commit();

        // Best-effort, mirrors the note in suspendAdmin above.
        await adminSuspensionCacheRepository.clearSuspension(adminId);

        return ServiceResponse.success({
            message: ADMIN_MANAGEMENT_MESSAGES.ACTIVATE_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_MANAGEMENT_MESSAGES.ACTIVATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    getAdminList,
    getAdminDetail,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    suspendAdmin,
    activateAdmin
};