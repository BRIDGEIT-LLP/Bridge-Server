const { Op } = require('sequelize');
const { UserSubscription } = require("../models");

const findActivePrememiumSubscription = async (companyId, userId) => {
    return await UserSubscription.findOne({
        where: {
            user_id: userId,
            company_id: companyId,
            status: 'active',
            is_deleted: false
        }
    });
}


module.exports = {
    findActivePrememiumSubscription
}