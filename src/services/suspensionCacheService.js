'use strict';

const userRepository = require('../repositories/userRepository');
const suspensionCacheRepository = require('../repositories/suspensionCacheRepository');

/**
 * Loads every currently-suspended user into Redis. Run once on boot, after
 * the DB connects, so authMiddleware's per-request suspension check serves
 * the steady state from Redis rather than Postgres from the very first
 * request.
 */
const loadSuspendedUsersIntoCache = async () => {
    const suspendedUsers = await userRepository.getSuspendedUsersWithRoleAndCompany();

    await suspensionCacheRepository.bulkCacheSuspensions(suspendedUsers);

    console.info(`Loaded ${suspendedUsers.length} suspended users into Redis.`);
};

module.exports = { loadSuspendedUsersIntoCache };
