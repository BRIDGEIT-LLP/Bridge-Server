'use strict';
const { RoleFieldMetadata, CompanyRoleMaster } = require('../models');

const getFieldsForRole = async (roleId) => {
    return await RoleFieldMetadata.findAll({
        where: { role_id: roleId, is_deleted: false },
        order: [['display_order', 'ASC'], ['field_name', 'ASC']]
    });
};


module.exports = {
    getFieldsForRole
};
