'use strict';

const { DealRoomArchive } = require('../models');

const findByDealRoomAndUser = async (dealRoomId, userId) => {
    return await DealRoomArchive.findOne({
        where: { deal_room_id: dealRoomId, user_id: userId, is_deleted: false }
    });
};

const archive = async (dealRoomId, userId, { transaction } = {}) => {
    return await DealRoomArchive.create({
        deal_room_id: dealRoomId,
        user_id: userId,
        archived_at: new Date(),
        created_by: userId
    }, { transaction });
};

const unarchive = async (dealRoomId, userId, { transaction } = {}) => {
    return await DealRoomArchive.destroy({
        where: { deal_room_id: dealRoomId, user_id: userId },
        transaction
    });
};

module.exports = { findByDealRoomAndUser, archive, unarchive };
