'use strict';

const { UserConnectionStatusLog } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await UserConnectionStatusLog.create(data, { transaction });
};

module.exports = { create };
