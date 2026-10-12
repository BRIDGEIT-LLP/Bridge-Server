'use strict';

const redis = require('../configs/redis');
const { errorLogger } = require('../configs/logger');
const { SESSION_CACHE_TTL_SECONDS } = require('../configs/sessionConfig');

const sessionKey = (userId) => `session:jti:${userId}`;

// Overwrites the cached set of a user's active JTIs and (re)applies the fixed
// TTL. Best-effort — failures are logged and swallowed, since Postgres stays
// the source of truth and a missing cache just means the next request rebuilds it.
const cacheActiveJtis = async (userId, jtis) => {
    try {
        const key = sessionKey(userId);
        const pipeline = redis.pipeline();
        pipeline.del(key);
        if (jtis.length > 0) {
            pipeline.sadd(key, ...jtis);
        }
        pipeline.expire(key, SESSION_CACHE_TTL_SECONDS);
        await pipeline.exec();
    } catch (error) {
        errorLogger.error('[sessionCacheRepository.cacheActiveJtis] failed:', error.message);
    }
};

// 'MISS'    -> key absent/expired, caller must rebuild from Postgres.
// 'VALID'   -> jti is a member of the cached active-session set.
// 'INVALID' -> key present but jti is not among the cached active sessions.
//
// Deliberately does not catch Redis errors — callers rely on the throw to
// fail open to a direct Postgres check (see authMiddleware.js).
const checkJti = async (userId, jti) => {
    const key = sessionKey(userId);
    const exists = await redis.exists(key);
    if (!exists) return 'MISS';

    const isMember = await redis.sismember(key, jti);
    return isMember ? 'VALID' : 'INVALID';
};

// Called on single-session logout/revoke — drops one jti immediately instead
// of waiting for the TTL to age it out.
const removeJti = async (userId, jti) => {
    try {
        await redis.srem(sessionKey(userId), jti);
    } catch (error) {
        errorLogger.error('[sessionCacheRepository.removeJti] failed:', error.message);
    }
};

// Called on logout-all / password-reset revoke-all — drops the whole cached
// set so the next request rebuilds it from Postgres.
const invalidateUser = async (userId) => {
    try {
        await redis.del(sessionKey(userId));
    } catch (error) {
        errorLogger.error('[sessionCacheRepository.invalidateUser] failed:', error.message);
    }
};

module.exports = {
    cacheActiveJtis,
    checkJti,
    removeJti,
    invalidateUser
};
