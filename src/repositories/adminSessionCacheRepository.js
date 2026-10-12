'use strict';

/**
 * IMPORTANT: Verify this import path matches your project's Redis client.
 * It should be the same path used in sessionCacheRepository.js.
 */
const redisClient = require('../configs/redis');
const { SESSION_CACHE_TTL_SECONDS } = require('../configs/sessionConfig');
const { errorLogger } = require('../configs/logger');

/**
 * Redis key for the admin's active JTI set.
 * Uses the prefix 'session:admin:jti:' to avoid collisions with the
 * user session cache which uses 'session:jti:{userId}'.
 */
const cacheKey = (adminId) => `session:admin:jti:${adminId}`;

/**
 * Replace the cached JTI set for an admin atomically.
 * Runs del + sadd + expire in a single pipeline so the set is never
 * partially written. Called after session creation and on cache misses.
 *
 * @param {string}   adminId
 * @param {string[]} jtis    - Array of active JTIs (may be empty)
 */
const cacheActiveJtis = async (adminId, jtis) => {
    try {
        const key = cacheKey(adminId);
        const pipeline = redisClient.pipeline();
        pipeline.del(key);
        if (jtis.length > 0) {
            pipeline.sadd(key, ...jtis);
        }
        pipeline.expire(key, SESSION_CACHE_TTL_SECONDS);
        await pipeline.exec();
    } catch (error) {
        // Best-effort: a Redis failure on cache-prime is non-fatal. The session row
        // exists in Postgres and adminMiddleware rebuilds the cache on the next MISS.
        // Matches the user-side sessionCacheRepository.cacheActiveJtis behaviour.
        errorLogger.error('[adminSessionCacheRepository.cacheActiveJtis] Redis error:', error.message);
    }
};

/**
 * Check whether a JTI belongs to the admin's active session set.
 *
 * Returns:
 *   'MISS'    — key doesn't exist in Redis (cold cache, fall back to Postgres)
 *   'VALID'   — JTI is a member of the set (session is active)
 *   'INVALID' — key exists but JTI is not a member (session revoked or expired)
 *
 * Throws on Redis errors so the caller can catch and fall back to Postgres.
 */
const checkJti = async (adminId, jti) => {
    const key = cacheKey(adminId);
    const exists = await redisClient.exists(key);
    if (!exists) {
        return 'MISS';
    }
    const isMember = await redisClient.sismember(key, jti);
    return isMember ? 'VALID' : 'INVALID';
};

/**
 * Remove a single JTI from the admin's cached set (on session revocation).
 * Best-effort — logs errors but never throws, so a Redis hiccup never blocks logout.
 */
const removeJti = async (adminId, jti) => {
    try {
        await redisClient.srem(cacheKey(adminId), jti);
    } catch (error) {
        errorLogger.error('[adminSessionCacheRepository.removeJti] Redis error:', error.message);
    }
};

/**
 * Delete the admin's entire JTI cache.
 * Used on logout-all. Best-effort — logs errors but never throws.
 */
const invalidateAdmin = async (adminId) => {
    try {
        await redisClient.del(cacheKey(adminId));
    } catch (error) {
        errorLogger.error('[adminSessionCacheRepository.invalidateAdmin] Redis error:', error.message);
    }
};

module.exports = {
    cacheActiveJtis,
    checkJti,
    removeJti,
    invalidateAdmin
};
