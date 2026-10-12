'use strict';

const redis = require('../configs/redis');
const permissionRepository = require('../repositories/permissionRepository');
const adminManagementRepository = require('../repositories/adminManagementRepository');
const { errorLogger } = require('../configs/logger');

const CACHE_PREFIX = 'role_permissions:';

const cacheKeyFor = (userType) => `${CACHE_PREFIX}${userType}`;

/**
 * Loads the full userType -> permission mapping from the database into Redis,
 * grouped by user_type. Run once Redis connects so hasPermission() serves the
 * steady state from Redis rather than the database.
 *
 * This is a warm-up, not a correctness requirement: getPermissionKeysForUserType
 * below is cache-aside and rebuilds any missing entry on demand, so a failed or
 * slow preload costs latency, not access.
 */
const loadAllRolePermissionsIntoCache = async () => {
    const grants = await permissionRepository.getAllRolePermissions();

    const permissionsByUserType = {};
    grants.forEach((grant) => {
        if (!permissionsByUserType[grant.user_type]) {
            permissionsByUserType[grant.user_type] = [];
        }
        permissionsByUserType[grant.user_type].push(grant.permission_key);
    });

    const pipeline = redis.pipeline();
    Object.keys(permissionsByUserType).forEach((userType) => {
        pipeline.set(cacheKeyFor(userType), JSON.stringify(permissionsByUserType[userType]));
    });
    await pipeline.exec();

    console.info(`Loaded permissions for ${Object.keys(permissionsByUserType).length} roles into Redis.`);
};

/**
 * Cache-aside read of a userType's permission keys. Postgres is the source of
 * truth; Redis is only an accelerator:
 *
 *   - cache hit   -> served from Redis (the steady state)
 *   - cache miss  -> rebuilt from Postgres and backfilled into Redis
 *   - Redis error -> read straight from Postgres
 *
 * Without this, an empty or unreachable cache denies (403) or errors (500) on
 * every authorize()-gated route. Mirrors isSessionJtiValid in authMiddleware.
 */
const getPermissionKeysForUserType = async (userType) => {
    try {
        const cached = await redis.get(cacheKeyFor(userType));

        // Distinguish a miss (null) from a legitimately empty grant list ('[]').
        if (cached !== null && cached !== undefined) {
            return JSON.parse(cached);
        }
    } catch (error) {
        errorLogger.error('[permissionService] Redis read failed, falling back to DB:', error.message);
        return permissionRepository.getPermissionKeysForUserType(userType);
    }

    const permissionKeys = await permissionRepository.getPermissionKeysForUserType(userType);

    try {
        await redis.set(cacheKeyFor(userType), JSON.stringify(permissionKeys));
    } catch (error) {
        // Backfill is best-effort — the caller already has the authoritative answer.
        errorLogger.error('[permissionService] Failed to backfill permission cache:', error.message);
    }

    return permissionKeys;
};

const hasPermission = async (userType, permissionKey) => {
    if (!userType || !permissionKey) {
        return false;
    }

    const permissionKeys = await getPermissionKeysForUserType(userType);
    return permissionKeys.includes(permissionKey);
};

const invalidateUserTypeCache = async (userType) => {
    try {
        await redis.del(cacheKeyFor(userType));
    } catch (error) {
        errorLogger.error(error);
    }
};


const getAdminPermissions = async (adminId) => {
    return adminManagementRepository.getAdminPermissions(adminId);
};

module.exports = {
    loadAllRolePermissionsIntoCache,
    hasPermission,
    invalidateUserTypeCache,
    getAdminPermissions
};
