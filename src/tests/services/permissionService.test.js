'use strict';

const mockPipeline = { set: jest.fn(), exec: jest.fn() };

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    pipeline: jest.fn()
}));

jest.mock('../../repositories/permissionRepository', () => ({
    getAllRolePermissions: jest.fn(),
    getPermissionKeysForUserType: jest.fn()
}));

jest.mock('../../repositories/adminManagementRepository', () => ({
    getAdminPermissions: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const redis = require('../../configs/redis');
const permissionRepository = require('../../repositories/permissionRepository');
const adminManagementRepository = require('../../repositories/adminManagementRepository');
const permissionService = require('../../services/permissionService');

describe('permissionService.loadAllRolePermissionsIntoCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockPipeline.set.mockClear();
        mockPipeline.exec.mockClear();
        redis.pipeline.mockReturnValue(mockPipeline);
    });

    test('groups grants by user_type and writes each userType to redis via a pipeline', async () => {
        permissionRepository.getAllRolePermissions.mockResolvedValue([
            { user_type: 'USER', permission_key: 'DEAL_ROOM.CLOSE' },
            { user_type: 'USER', permission_key: 'DEAL_ROOM.VIEW_LIST' },
            { user_type: 'ADMIN', permission_key: 'ADMIN_USER.LIST' }
        ]);

        await permissionService.loadAllRolePermissionsIntoCache();

        expect(mockPipeline.set).toHaveBeenCalledWith(
            'role_permissions:USER',
            JSON.stringify(['DEAL_ROOM.CLOSE', 'DEAL_ROOM.VIEW_LIST'])
        );
        expect(mockPipeline.set).toHaveBeenCalledWith(
            'role_permissions:ADMIN',
            JSON.stringify(['ADMIN_USER.LIST'])
        );
        expect(mockPipeline.exec).toHaveBeenCalled();
    });
});

describe('permissionService.hasPermission', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns false when userType or permissionKey is missing', async () => {
        expect(await permissionService.hasPermission(null, 'DEAL_ROOM.CLOSE')).toBe(false);
        expect(await permissionService.hasPermission('USER', null)).toBe(false);
        expect(redis.get).not.toHaveBeenCalled();
    });

    test('returns true when redis has the permission for the userType', async () => {
        redis.get.mockResolvedValue(JSON.stringify(['DEAL_ROOM.CLOSE']));

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(true);
        expect(redis.get).toHaveBeenCalledWith('role_permissions:USER');
    });

    test('returns false when the userType does not have the requested permission', async () => {
        redis.get.mockResolvedValue(JSON.stringify(['DEAL_ROOM.VIEW_LIST']));

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(false);
    });

    /*
     * Redis is an accelerator, not the source of truth. An empty or unreachable
     * cache must not deny access to every authorize()-gated route.
     */
    test('falls back to the database when redis has no entry for the userType', async () => {
        redis.get.mockResolvedValue(null);
        permissionRepository.getPermissionKeysForUserType.mockResolvedValue(['DEAL_ROOM.CLOSE']);

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(true);
        expect(permissionRepository.getPermissionKeysForUserType).toHaveBeenCalledWith('USER');
    });

    test('backfills the cache after rebuilding from the database', async () => {
        redis.get.mockResolvedValue(null);
        permissionRepository.getPermissionKeysForUserType.mockResolvedValue(['DEAL_ROOM.CLOSE']);

        await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(redis.set).toHaveBeenCalledWith(
            'role_permissions:USER',
            JSON.stringify(['DEAL_ROOM.CLOSE'])
        );
    });

    test('falls back to the database when redis throws', async () => {
        redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
        permissionRepository.getPermissionKeysForUserType.mockResolvedValue(['DEAL_ROOM.CLOSE']);

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(true);
    });

    test('falls back to the database when the cached value is corrupt', async () => {
        redis.get.mockResolvedValue('not-json');
        permissionRepository.getPermissionKeysForUserType.mockResolvedValue(['DEAL_ROOM.CLOSE']);

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(true);
    });

    test('treats a cached empty grant list as authoritative and does not hit the database', async () => {
        redis.get.mockResolvedValue(JSON.stringify([]));

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(false);
        expect(permissionRepository.getPermissionKeysForUserType).not.toHaveBeenCalled();
    });

    test('denies when neither redis nor the database grants the permission', async () => {
        redis.get.mockResolvedValue(null);
        permissionRepository.getPermissionKeysForUserType.mockResolvedValue(['DEAL_ROOM.VIEW_LIST']);

        const result = await permissionService.hasPermission('USER', 'DEAL_ROOM.CLOSE');

        expect(result).toBe(false);
    });
});

describe('permissionService.invalidateUserTypeCache', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('deletes the cache entry for the userType', async () => {
        await permissionService.invalidateUserTypeCache('USER');

        expect(redis.del).toHaveBeenCalledWith('role_permissions:USER');
    });
});

describe('permissionService.getAdminPermissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('delegates to adminManagementRepository.getAdminPermissions and returns its result', async () => {
        const grants = [{ permission_key: 'FAQ_MANAGEMENT', is_allowed: true }];
        adminManagementRepository.getAdminPermissions.mockResolvedValue(grants);

        const result = await permissionService.getAdminPermissions('admin-1');

        expect(result).toBe(grants);
        expect(adminManagementRepository.getAdminPermissions).toHaveBeenCalledWith('admin-1');
    });
});
