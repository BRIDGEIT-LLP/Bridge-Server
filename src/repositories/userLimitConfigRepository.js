'use strict';
const { UserLimitConfig } = require('../models');

const findByUserId = async (userId) => {
    return await UserLimitConfig.findOne({
        where: { user_id: userId, is_deleted: false }
    });
};

// Always called from an admin's explicit "customize limits" request, so every
// write here — create or update — must stamp updated_by. getUserLimitConfig
// relies on updated_by being non-null to mean "an admin customized this".
const upsertUserLimitConfig = async (userId, data, adminId, { transaction } = {}) => {
    const existing = await UserLimitConfig.findOne({
        where: { user_id: userId, is_deleted: false },
        transaction
    });

    if (existing) {
        const [, [updated]] = await UserLimitConfig.update(
            {
                ...data,
                updated_by: adminId,
                updated_at: new Date()
            },
            {
                where: { user_id: userId, is_deleted: false },
                returning: true,
                transaction
            }
        );
        return updated;
    }

    return await UserLimitConfig.create(
        {
            user_id: userId,
            ...data,
            created_by: adminId,
            updated_by: adminId
        },
        { transaction }
    );
};

// Seeds trial defaults on KYC approval. Never touches an existing row (an
// admin's earlier customization must not be clobbered) and never stamps
// updated_by, so the resulting row is not mistaken for an admin customization.
const createDefaultUserLimitConfig = async (userId, data, adminId, { transaction } = {}) => {
    const existing = await UserLimitConfig.findOne({
        where: { user_id: userId, is_deleted: false },
        transaction
    });

    if (existing) {
        return existing;
    }

    return await UserLimitConfig.create(
        {
            user_id: userId,
            ...data,
            created_by: adminId
        },
        { transaction }
    );
};

module.exports = { findByUserId, upsertUserLimitConfig, createDefaultUserLimitConfig };