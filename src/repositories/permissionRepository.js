'use strict';

const { RolePermissionMap, PermissionMaster } = require('../models');

const getPermissionKeysForUserType = async (userType) => {
    const grants = await RolePermissionMap.findAll({
        where: { user_type: userType, is_deleted: false },
        include: [{
            model: PermissionMaster,
            as: 'permission',
            attributes: ['permission_key'],
            where: { is_deleted: false }
        }],
        attributes: []
    });

    return grants.map((grant) => grant.permission.permission_key);
};

/**
 * Fetches every active user_type -> permission grant, for bulk-loading the
 * full mapping (e.g. into Redis at startup).
 */
const getAllRolePermissions = async () => {
    const grants = await RolePermissionMap.findAll({
        where: { is_deleted: false },
        include: [{
            model: PermissionMaster,
            as: 'permission',
            attributes: ['permission_key'],
            where: { is_deleted: false }
        }],
        attributes: ['user_type']
    });

    return grants.map((grant) => ({
        user_type: grant.user_type,
        permission_key: grant.permission.permission_key
    }));
};

module.exports = {
    getPermissionKeysForUserType,
    getAllRolePermissions
};
