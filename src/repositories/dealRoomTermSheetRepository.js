'use strict';

const { DealRoomTermSheet, User } = require('../models');

// Minimal name-only user join for display — mirrors OFFER_USER_INCLUDES in
// dealRoomOfferRepository.js.
const TERM_SHEET_USER_INCLUDE = [
    { model: User, as: 'updatedBy', attributes: ['id', 'first_name', 'last_name'] }
];

const create = async (data, { transaction } = {}) => {
    const created = await DealRoomTermSheet.create(data, { transaction });
    return await DealRoomTermSheet.findOne({ where: { id: created.id }, include: TERM_SHEET_USER_INCLUDE, transaction });
};

const findLatestByDealRoomId = async (dealRoomId) => {
    return await DealRoomTermSheet.findOne({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false
        },
        include: TERM_SHEET_USER_INCLUDE,
        order: [['version', 'DESC']]
    });
};

const findAllByDealRoomId = async (dealRoomId) => {
    return await DealRoomTermSheet.findAll({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false
        },
        include: TERM_SHEET_USER_INCLUDE,
        order: [['version', 'ASC']]
    });
};

module.exports = { create, findLatestByDealRoomId, findAllByDealRoomId };
