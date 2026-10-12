'use strict';

const { AdminSuspensionHistory } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await AdminSuspensionHistory.create(data, { transaction });
};

const findLatestByAdminId = async (adminId, { transaction } = {}) => {
    return await AdminSuspensionHistory.findOne({
        where: { admin_id: adminId },
        order: [['created_at', 'DESC']],
        transaction
    });
};

module.exports = { create, findLatestByAdminId };
