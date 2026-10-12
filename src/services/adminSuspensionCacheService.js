'use strict';

const adminManagementRepository = require('../repositories/adminManagementRepository');
const adminSuspensionCacheRepository = require('../repositories/adminSuspensionCacheRepository');

/**
 * Loads every currently-suspended admin into Redis. Run once on boot, after
 * the DB connects, so adminMiddleware's per-request suspension check serves
 * the steady state from Redis rather than Postgres from the very first
 * request.
 */
const loadSuspendedAdminsIntoCache = async () => {
    const suspendedAdmins = await adminManagementRepository.getSuspendedAdminsWithReason();

    await adminSuspensionCacheRepository.bulkCacheSuspensions(suspendedAdmins);

    console.info(`Loaded ${suspendedAdmins.length} suspended admins into Redis.`);
};

module.exports = { loadSuspendedAdminsIntoCache };
