'use strict';

const redis = require('../configs/redis');
const { errorLogger } = require('../configs/logger');
const { REDIS_BASE_KEYS } = require('../utils/constant');

// All suspended admins live in one Redis hash: suspended_admins -> { [adminId]: JSON }.
// Kept separate from the user suspended_users hash so the two id spaces never collide
// and either cache can be invalidated/rebuilt independently.
const HASH_KEY = REDIS_BASE_KEYS.SUSPENDED_ADMINS_HASH;

// In-memory mirror of that hash, so adminMiddleware can check suspension with
// zero network calls on the request path. Hydrated once at boot from
// Postgres (see adminSuspensionCacheService.loadSuspendedAdminsIntoCache) and kept
// in sync in-process by every cacheSuspension/clearSuspension call below.
//
// Caveat: this only stays correct for a single Node process. If this app is
// ever run as multiple instances, only the instance that handles a given
// suspend/activate call updates its own Map immediately — the others
// only pick it up on their next restart (which re-hydrates from Postgres).
let suspendedAdminsCache = new Map();
let isHydrated = false;

// Best-effort — failures are logged and swallowed, since Postgres stays the
// source of truth and a missing Redis entry just falls back to a DB read.
const cacheSuspension = async (adminId, { reason, suspendedAt }) => {
    const data = { reason, suspendedAt };

    suspendedAdminsCache.set(adminId, data);

    try {
        await redis.hset(HASH_KEY, adminId, JSON.stringify(data));
    } catch (error) {
        errorLogger.error('[adminSuspensionCacheRepository.cacheSuspension] failed:', error.message);
    }
};

const clearSuspension = async (adminId) => {
    suspendedAdminsCache.delete(adminId);

    try {
        await redis.hdel(HASH_KEY, adminId);
    } catch (error) {
        errorLogger.error('[adminSuspensionCacheRepository.clearSuspension] failed:', error.message);
    }
};

// Redis read — only used as a cold-start fallback (see adminMiddleware.js)
// for the brief window before the boot-time hydration finishes. Deliberately
// does not catch Redis errors — the caller relies on the throw to fail open
// to a direct Postgres check.
const getSuspension = async (adminId) => {
    const cached = await redis.hget(HASH_KEY, adminId);
    return cached ? JSON.parse(cached) : null;
};

// Synchronous in-memory lookup — the check adminMiddleware uses once hydrated.
const getSuspensionFromMemory = (adminId) => suspendedAdminsCache.get(adminId) ?? null;

const isMemoryHydrated = () => isHydrated;

// Startup warm-up — replaces both the in-memory Map and the Redis hash so
// admins reactivated while the app was down don't linger as stale entries.
const bulkCacheSuspensions = async (suspendedAdmins) => {
    const freshCache = new Map();
    suspendedAdmins.forEach(({ adminId, reason, suspendedAt }) => {
        freshCache.set(adminId, { reason, suspendedAt });
    });
    suspendedAdminsCache = freshCache;
    isHydrated = true;

    const pipeline = redis.pipeline();
    pipeline.del(HASH_KEY);
    suspendedAdmins.forEach(({ adminId, reason, suspendedAt }) => {
        pipeline.hset(HASH_KEY, adminId, JSON.stringify({ reason, suspendedAt }));
    });
    await pipeline.exec();
};

module.exports = {
    cacheSuspension,
    clearSuspension,
    getSuspension,
    getSuspensionFromMemory,
    isMemoryHydrated,
    bulkCacheSuspensions
};
