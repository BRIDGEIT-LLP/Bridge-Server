'use strict';

const { DealRoomOffer, User } = require('../models');
const { DEAL_ROOM_OFFER_STATUS } = require('../utils/constant');

// Minimal name-only user joins for display — shared by every read used to render
// offers (thread view + current-offer card).
const OFFER_USER_INCLUDES = [
    { model: User, as: 'offeredBy', attributes: ['id', 'first_name', 'last_name'] },
    { model: User, as: 'recipient', attributes: ['id', 'first_name', 'last_name'] },
    { model: User, as: 'respondedBy', attributes: ['id', 'first_name', 'last_name'] }
];

const create = async (data, { transaction } = {}) => {
    return await DealRoomOffer.create(data, { transaction });
};

const findById = async (offerId) => {
    return await DealRoomOffer.findOne({
        where: { id: offerId, is_deleted: false }
    });
};

const findPendingByDealRoomId = async (dealRoomId) => {
    return await DealRoomOffer.findOne({
        where: {
            deal_room_id: dealRoomId,
            status: DEAL_ROOM_OFFER_STATUS.PENDING,
            is_deleted: false
        },
        include: OFFER_USER_INCLUDES
    });
};

const findDraftByUserId = async (dealRoomId, userId) => {
    return await DealRoomOffer.findOne({
        where: {
            deal_room_id: dealRoomId,
            offered_by_user_id: userId,
            status: DEAL_ROOM_OFFER_STATUS.DRAFT,
            is_deleted: false
        }
    });
};

// Whole negotiation thread in one flat query — every row (root + counters)
// shares the same root_offer_id.
const findThreadByRootId = async (rootOfferId) => {
    return await DealRoomOffer.findAll({
        where: {
            root_offer_id: rootOfferId,
            is_deleted: false
        },
        include: OFFER_USER_INCLUDES,
        order: [['version', 'ASC']]
    });
};

// Every offer ever created in this room, across every thread (not just the latest) —
// ordered chronologically so each thread's rows stay version-ascending internally.
const findAllByDealRoomId = async (dealRoomId) => {
    return await DealRoomOffer.findAll({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false
        },
        include: OFFER_USER_INCLUDES,
        order: [['created_at', 'ASC']]
    });
};

const findLatestByDealRoomId = async (dealRoomId) => {
    return await DealRoomOffer.findOne({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false
        },
        include: OFFER_USER_INCLUDES,
        order: [['created_at', 'DESC']]
    });
};

const updateDraft = async (offerId, data, { transaction } = {}) => {
    const [, [updated]] = await DealRoomOffer.update(
        {
            ...data,
            updated_at: new Date()
        },
        { where: { id: offerId }, returning: true, transaction }
    );
    return updated;
};

// Draft -> Pending transition when the investor clicks "Send Offer" on a saved draft.
const promoteDraftToPending = async (offerId, { updatedBy, transaction } = {}) => {
    const [, [updated]] = await DealRoomOffer.update(
        {
            status: DEAL_ROOM_OFFER_STATUS.PENDING,
            sent_at: new Date(),
            updated_at: new Date(),
            updated_by: updatedBy
        },
        { where: { id: offerId }, returning: true, transaction }
    );
    return updated;
};

// A root offer points at itself; the id only exists after insert, hence this
// second write right after create.
const setRootOfferId = async (offerId, rootOfferId, { transaction } = {}) => {
    const [, [updated]] = await DealRoomOffer.update(
        { root_offer_id: rootOfferId },
        { where: { id: offerId }, returning: true, transaction }
    );
    return updated;
};

// Terminal transitions: Pending -> Accepted / Rejected / Countered, stamping who
// responded and when.
const updateStatus = async (offerId, { status, respondedByUserId, transaction } = {}) => {
    const [, [updated]] = await DealRoomOffer.update(
        {
            status,
            responded_by_user_id: respondedByUserId,
            responded_at: new Date(),
            updated_at: new Date(),
            updated_by: respondedByUserId
        },
        { where: { id: offerId }, returning: true, transaction }
    );
    return updated;
};

module.exports = {
    create,
    findById,
    findPendingByDealRoomId,
    findDraftByUserId,
    findThreadByRootId,
    findAllByDealRoomId,
    findLatestByDealRoomId,
    updateDraft,
    promoteDraftToPending,
    setRootOfferId,
    updateStatus
};
