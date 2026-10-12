'use strict';

const { UserSuspensionHistory } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await UserSuspensionHistory.create(data, { transaction });
};

const findLatestByUserId = async (userId, { transaction } = {}) => {
    return await UserSuspensionHistory.findOne({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        transaction
    });
};

const findAllByUserId = async (userId, { transaction } = {}) => {
    return await UserSuspensionHistory.findAll({
        where: { user_id: userId },
        order: [['created_at', 'DESC']],
        transaction
    });
};

module.exports = { create, findLatestByUserId, findAllByUserId };
