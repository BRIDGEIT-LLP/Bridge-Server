'use strict';

/**
 * SESSION_LIMIT_ENABLED=true  -> session tracking + per-request enforcement ON
 * SESSION_LIMIT_ENABLED=false -> per-request DB session check skipped (pure
 *                                 stateless JWT verification, as before this
 *                                 feature existed); max-session eviction at
 *                                 login also skipped.
 * MAX_ACTIVE_SESSIONS         -> integer, defaults to 3 if unset/invalid.
 * SESSION_CACHE_TTL_SECONDS   -> TTL (seconds) for the Redis cache of a user's
 *                                 active JTIs (session:jti:{userId}). Fixed
 *                                 TTL, not sliding — see docs/plans/redis-session-jti-cache.md.
 *                                 Defaults to 2700 (45m) if unset/invalid.
 */
const SESSION_LIMIT_ENABLED = String(process.env.SESSION_LIMIT_ENABLED).toLowerCase() === 'true';

const parsedMax = parseInt(process.env.MAX_ACTIVE_SESSIONS, 10);
const MAX_ACTIVE_SESSIONS = Number.isFinite(parsedMax) && parsedMax > 0 ? parsedMax : 3;

const parsedCacheTtl = parseInt(process.env.SESSION_CACHE_TTL_SECONDS, 10);
const SESSION_CACHE_TTL_SECONDS = Number.isFinite(parsedCacheTtl) && parsedCacheTtl > 0 ? parsedCacheTtl : 45 * 60;

module.exports = {
  SESSION_LIMIT_ENABLED,
  MAX_ACTIVE_SESSIONS,
  SESSION_CACHE_TTL_SECONDS,
};
