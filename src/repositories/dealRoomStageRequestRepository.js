'use strict';

const { DealRoomStageRequest } = require('../models');
const { DEAL_ROOM_STAGE_REQUEST_STATUS } = require('../utils/constant');

const create = async (data, { transaction } = {}) => {
    return await DealRoomStageRequest.create(data, { transaction });
};

const findById = async (requestId) => {
    return await DealRoomStageRequest.findOne({
        where: { id: requestId, is_deleted: false }
    });
};

const findPendingByDealRoomId = async (dealRoomId) => {
    return await DealRoomStageRequest.findOne({
        where: {
            deal_room_id: dealRoomId,
            status: DEAL_ROOM_STAGE_REQUEST_STATUS.PENDING,
            is_deleted: false
        }
    });
};

const respond = async (requestId, { status, respondedByUserId }, { transaction } = {}) => {
    const [, [updated]] = await DealRoomStageRequest.update(
        {
            status,
            responded_by_user_id: respondedByUserId,
            responded_at: new Date(),
            updated_by: respondedByUserId
        },
        { where: { id: requestId }, returning: true, transaction }
    );
    return updated;
};

module.exports = { create, findById, findPendingByDealRoomId, respond };
