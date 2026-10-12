'use strict';

const redis = require('../configs/redis');
const { errorLogger } = require('../configs/logger');
const { REDIS_BASE_KEYS } = require('../utils/constant');

// All suspended users live in one Redis hash: suspended_users -> { [userId]: JSON }.
// Field-level HSET/HDEL keep individual entries O(1) without spreading suspension
// state across many top-level keys.
const HASH_KEY = REDIS_BASE_KEYS.SUSPENDED_USERS_HASH;

// In-memory mirror of that hash, so authMiddleware can check suspension with
// zero network calls on the request path. Hydrated once at boot from
// Postgres (see suspensionCacheService.loadSuspendedUsersIntoCache) and kept
// in sync in-process by every cacheSuspension/clearSuspension call below.
// Redis stays the persisted copy (survives restarts, reloaded at boot); this
// Map is a same-process read accelerator on top of it.
//
// Caveat: this only stays correct for a single Node process. If this app is
// ever run as multiple instances, only the instance that handles a given
// admin suspend/reactivate call updates its own Map immediately — the others
// only pick it up on their next restart (which re-hydrates from Postgres).
let suspendedUsersCache = new Map();
let isHydrated = false;

// Best-effort — failures are logged and swallowed, since Postgres stays the
// source of truth and a missing Redis entry just falls back to a DB read.
const cacheSuspension = async (userId, { reason, companyId, roleId, role, suspendedAt }) => {
    const data = { reason, companyId, roleId, role, suspendedAt };

    suspendedUsersCache.set(userId, data);

    try {
        await redis.hset(HASH_KEY, userId, JSON.stringify(data));
    } catch (error) {
        errorLogger.error('[suspensionCacheRepository.cacheSuspension] failed:', error.message);
    }
};

const clearSuspension = async (userId) => {
    suspendedUsersCache.delete(userId);

    try {
        await redis.hdel(HASH_KEY, userId);
    } catch (error) {
        errorLogger.error('[suspensionCacheRepository.clearSuspension] failed:', error.message);
    }
};

// Redis read — only used as a cold-start fallback (see authMiddleware.js)
// for the brief window before the boot-time hydration finishes. Deliberately
// does not catch Redis errors — the caller relies on the throw to fail open
// to a direct Postgres check.
const getSuspension = async (userId) => {
    const cached = await redis.hget(HASH_KEY, userId);
    return cached ? JSON.parse(cached) : null;
};

// Synchronous in-memory lookup — the check authMiddleware uses once hydrated.
const getSuspensionFromMemory = (userId) => suspendedUsersCache.get(userId) ?? null;

const isMemoryHydrated = () => isHydrated;

// Startup warm-up — replaces both the in-memory Map and the Redis hash so
// users reactivated while the app was down don't linger as stale entries.
const bulkCacheSuspensions = async (suspendedUsers) => {
    const freshCache = new Map();
    suspendedUsers.forEach(({ userId, reason, companyId, roleId, role, suspendedAt }) => {
        freshCache.set(userId, { reason, companyId, roleId, role, suspendedAt });
    });
    suspendedUsersCache = freshCache;
    isHydrated = true;

    const pipeline = redis.pipeline();
    pipeline.del(HASH_KEY);
    suspendedUsers.forEach(({ userId, reason, companyId, roleId, role, suspendedAt }) => {
        pipeline.hset(HASH_KEY, userId, JSON.stringify({ reason, companyId, roleId, role, suspendedAt }));
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
