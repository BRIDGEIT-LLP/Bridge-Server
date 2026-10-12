'use strict';

const { DealRoomB2BConfirmation } = require('../models');

const findByDealRoomId = async (dealRoomId, { transaction } = {}) => {
    return await DealRoomB2BConfirmation.findOne({
        where: { deal_room_id: dealRoomId },
        transaction
    });
};

// One row per deal room: create it on the first Negotiation -> Due Diligence
// confirmation, overwrite it if the transition ever happens again.
const recordConfirmation = async (dealRoomId, { confirmedTermSheetId, requestedByUserId, acceptedByUserId, confirmedAt }, { transaction } = {}) => {
    const existing = await DealRoomB2BConfirmation.findOne({ where: { deal_room_id: dealRoomId }, transaction });

    const values = {
        confirmed_term_sheet_id: confirmedTermSheetId,
        requested_by_user_id: requestedByUserId,
        accepted_by_user_id: acceptedByUserId,
        confirmed_at: confirmedAt,
        updated_at: new Date()
    };

    if (existing) {
        const [, [updated]] = await DealRoomB2BConfirmation.update(values, {
            where: { id: existing.id },
            returning: true,
            transaction
        });
        return updated;
    }

    return await DealRoomB2BConfirmation.create({ deal_room_id: dealRoomId, ...values }, { transaction });
};

module.exports = { findByDealRoomId, recordConfirmation };
