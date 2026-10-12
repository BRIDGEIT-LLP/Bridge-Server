'use strict';

const { DealRoomStageRequestLog } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await DealRoomStageRequestLog.create(data, { transaction });
};

module.exports = { create };
