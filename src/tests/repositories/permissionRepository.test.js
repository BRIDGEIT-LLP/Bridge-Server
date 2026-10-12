'use strict';

jest.mock('../../models', () => ({
    RolePermissionMap: { findAll: jest.fn() },
    PermissionMaster: {}
}));

const { RolePermissionMap } = require('../../models');
const permissionRepository = require('../../repositories/permissionRepository');

describe('permissionRepository.getPermissionKeysForUserType', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns the permission_key of every active grant for the userType', async () => {
        RolePermissionMap.findAll.mockResolvedValue([
            { permission: { permission_key: 'DEAL_ROOM.CLOSE' } },
            { permission: { permission_key: 'DEAL_ROOM.VIEW_LIST' } }
        ]);

        const result = await permissionRepository.getPermissionKeysForUserType('USER');

        expect(result).toEqual(['DEAL_ROOM.CLOSE', 'DEAL_ROOM.VIEW_LIST']);
        expect(RolePermissionMap.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { user_type: 'USER', is_deleted: false }
            })
        );
    });

    test('returns an empty array when the userType has no grants', async () => {
        RolePermissionMap.findAll.mockResolvedValue([]);

        const result = await permissionRepository.getPermissionKeysForUserType('UNKNOWN');

        expect(result).toEqual([]);
    });
});

describe('permissionRepository.getAllRolePermissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns user_type paired with permission_key for every active grant', async () => {
        RolePermissionMap.findAll.mockResolvedValue([
            { user_type: 'USER', permission: { permission_key: 'DEAL_ROOM.CLOSE' } },
            { user_type: 'ADMIN', permission: { permission_key: 'ADMIN_USER.LIST' } }
        ]);

        const result = await permissionRepository.getAllRolePermissions();

        expect(result).toEqual([
            { user_type: 'USER', permission_key: 'DEAL_ROOM.CLOSE' },
            { user_type: 'ADMIN', permission_key: 'ADMIN_USER.LIST' }
        ]);
        expect(RolePermissionMap.findAll).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { is_deleted: false }
            })
        );
    });
});
