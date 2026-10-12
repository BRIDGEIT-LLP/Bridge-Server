'use strict';
const { Sequelize, sequelize, OtpConfigMaster, TrialConfigMaster } = require('../models');

const getAllConfig = async () => {
    return await OtpConfigMaster.findAll({
        where: { is_deleted: false },
        order: [['id', 'ASC']]
    });
};

const bulkUpdateConfig = async (updates, adminId, { transaction } = {}) => {
    await sequelize.query(
        `UPDATE otp_config_master AS t
         SET value = kv.value, updated_by = :adminId, updated_at = NOW()
         FROM jsonb_each_text(:updates::jsonb) AS kv(lookup, value)
         WHERE t.lookup = kv.lookup AND t.is_deleted = false`,
        {
            replacements: { adminId, updates: JSON.stringify(updates) },
            transaction
        }
    );
    return await OtpConfigMaster.findAll({
        where: { is_deleted: false },
        order: [['id', 'ASC']],
        transaction
    });
};

const getAllTrialConfig = async () => {
    return await TrialConfigMaster.findAll({
        where: { is_deleted: false },
        order: [['lookup', 'ASC']]
    });
};

const getTrialConfigByLookup = async (lookup) => {
    return await TrialConfigMaster.findOne({
        where: { lookup, is_deleted: false }
    });
};

const bulkUpdateTrialConfig = async (updates, adminId, { transaction } = {}) => {
    if (!Object.keys(updates).length) return [];

    const [updated] = await sequelize.query(
        `UPDATE trial_config_master AS t
         SET value = kv.value,
             updated_by = :adminId,
             updated_at = NOW()
         FROM jsonb_each_text(:updates::jsonb) AS kv(lookup, value)
         WHERE t.lookup = kv.lookup AND t.is_deleted = false
         RETURNING t.*;`,
        {
            replacements: { adminId, updates: JSON.stringify(updates) },
            type: Sequelize.QueryTypes.UPDATE,
            transaction
        }
    );

    return updated;
};


const resetConfigToDefaults = async (adminId, { transaction } = {}) => {
    await OtpConfigMaster.update(
        {
            value: sequelize.col('default_value'),
            updated_by: adminId,
            updated_at: new Date()
        },
        {
            where: { is_deleted: false },
            transaction
        }
    );
    return await OtpConfigMaster.findAll({
        where: { is_deleted: false },
        order: [['id', 'ASC']],
        transaction
    });
};

module.exports = {
    getAllConfig,
    bulkUpdateConfig,
    getAllTrialConfig,
    getTrialConfigByLookup,
    bulkUpdateTrialConfig,
    resetConfigToDefaults
};