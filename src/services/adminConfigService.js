'use strict';
const { sequelize } = require('../models');
const adminConfigRepository = require('../repositories/AdminConfigRepository');
const redis = require('../configs/redis');
const { errorLogger, applicationLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { ADMIN_CONFIG_MESSAGES, REDIS_BASE_KEYS, TRIAL_CONFIG_LOOKUP_KEYS } = require('../utils/constant');
const { formatValue } = require('../utils/Helper');

const OTP_CONFIG_CACHE_KEY = REDIS_BASE_KEYS.CONFIG_OTP_CONFIG;
const TRIAL_CONFIG_CACHE_KEY = REDIS_BASE_KEYS.CONFIG_TRIAL_CONFIG;

const getOtpConfig = async () => {
    try {
        const config = await adminConfigRepository.getAllConfig();

        return ServiceResponse.success({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_SUCCESS,
            data: config,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_FAILED,
            statusCode: 500
        });
    }
};

const updateOtpConfig = async (updates, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        const updated = await adminConfigRepository.bulkUpdateConfig(updates, adminId, { transaction });

        await transaction.commit();

        await cacheOtpConfig();

        return ServiceResponse.success({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_SUCCESS,
            data: updated,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_FAILED,
            statusCode: 500
        });
    }
};

const resetOtpConfig = async (adminId) => {
    const transaction = await sequelize.transaction();
    try {
        await adminConfigRepository.resetConfigToDefaults(adminId, { transaction });

        await transaction.commit();

        await cacheOtpConfig();

        return ServiceResponse.success({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_RESET_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_RESET_FAILED,
            statusCode: 500
        });
    }
};

const cacheOtpConfig = async () => {
    const config = await getOtpConfig();
    if (!config.success) return;

    const otpConfig = config.data;
    

    try {
        await redis.set(OTP_CONFIG_CACHE_KEY, JSON.stringify(otpConfig));
    } catch (error) {
        errorLogger.error('[AdminConfigService] Failed to cache OTP config:', error.message);
    }
};

const getOtpConfigValue = async (lookup) => {
    try {
        const cached = await redis.get(OTP_CONFIG_CACHE_KEY);

        if (cached) {
            const config = JSON.parse(cached);
            const row = config.find((c) => c.lookup === lookup);

            if (row) {
                return formatValue(row.value, row.data_type, row.unit);
            }
        }
    } catch (error) {
        errorLogger.error(
            `[AdminConfigService] Redis read failed for ${lookup}:`,
            error.message
        );
    }

    return Number(process.env[lookup]);
};

const getTrialConfig = async () => {
    try {
        const config = await adminConfigRepository.getAllTrialConfig();

        // `value` is stored as text; expose a typed copy so clients don't have to
        // coerce it themselves (the string "false" is truthy everywhere).
        const formattedConfig = config.map((row) => {
            const plainRow = row.toJSON();
            let formatted_value = plainRow.value;

            try {
                formatted_value = formatValue(plainRow.value, plainRow.data_type, plainRow.unit);
            } catch (error) {
                errorLogger.error(`[AdminConfigService] Failed to format trial config ${plainRow.lookup}:`, error.message);
            }

            return { ...plainRow, formatted_value };
        });

        return ServiceResponse.success({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_SUCCESS,
            data: formattedConfig,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_FETCH_FAILED,
            statusCode: 500
        });
    }
};

const updateTrialConfig = async (updates, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        const updated = await adminConfigRepository.bulkUpdateTrialConfig(updates, adminId, { transaction });

        await transaction.commit();

        await cacheTrialConfig();

        return ServiceResponse.success({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_SUCCESS,
            data: updated,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_CONFIG_MESSAGES.CONFIG_UPDATE_FAILED,
            statusCode: 500
        });
    }
};

const cacheTrialConfig = async () => {
    const config = await getTrialConfig();
    if (!config.success) return;

    try {
        await redis.set(TRIAL_CONFIG_CACHE_KEY, JSON.stringify(config.data));
        console.info(`Loaded ${config.data.length} trial config entries into Redis.`);
    } catch (error) {
        errorLogger.error('[AdminConfigService] Failed to cache trial config:', error.message);
    }
};

// Read-through: cache first, DB second, caller-supplied fallback last. Swapping
// the cache population trigger (e.g. a warmup job) is the only future change
// needed to make this fully Redis-backed.
const getTrialConfigValue = async (lookup, fallback) => {
    try {
        const cached = await redis.get(TRIAL_CONFIG_CACHE_KEY);
        if (cached) {
            const config = JSON.parse(cached);
            const row = config.find((c) => c.lookup === lookup);
            if (row) {
                return row.formatted_value;
            }
        }
    } catch (error) {
        errorLogger.error(`[AdminConfigService] Redis read failed for ${lookup}:`, error.message);
    }

    try {
        const row = await adminConfigRepository.getTrialConfigByLookup(lookup);
        if (row) {
            return formatValue(row.value, row.data_type, row.unit);
        }
    } catch (error) {
        errorLogger.error(`[AdminConfigService] DB read failed for ${lookup}:`, error.message);
    }

    return fallback;
};

const isAwsServiceEnabled = async () => {
    const value = await getTrialConfigValue(
        TRIAL_CONFIG_LOOKUP_KEYS.AWS_SERVICE_ENABLED
    );
    return value === true || String(value).toLowerCase() === 'true';
};

module.exports = { getOtpConfig, updateOtpConfig, cacheOtpConfig, getOtpConfigValue, getTrialConfig, updateTrialConfig, cacheTrialConfig, getTrialConfigValue, isAwsServiceEnabled, resetOtpConfig };
