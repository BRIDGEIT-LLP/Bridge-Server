'use strict';

const { DealRoomMedia, User } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await DealRoomMedia.create(data, { transaction });
};

const findById = async (mediaId) => {
    return await DealRoomMedia.findOne({
        where: { id: mediaId, is_deleted: false }
    });
};

const findSharedFilesByDealRoomId = async (dealRoomId) => {
    return await DealRoomMedia.findAll({
        where: { deal_room_id: dealRoomId, is_deleted: false },
        attributes: [
            'id', ['media_type', 'message_type'], 'attachment_s3_key', 'attachment_file_name',
            'attachment_mime_type', 'download_allowed', 'view_only', 'attachment_file_size', 'stage', 'created_at'
        ],
        include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name'] }],
        order: [['created_at', 'DESC'], ['id', 'DESC']]
    });
};

const markReadByDealRoom = async (dealRoomId, readerUserId, readAt, { transaction } = {}) => {
    const [count] = await DealRoomMedia.update(
        { read_at: readAt },
        {
            where: {
                deal_room_id: dealRoomId,
                recipient_user_id: readerUserId,
                read_at: null,
                is_deleted: false
            },
            transaction
        }
    );
    return count;
};

module.exports = { create, findById, findSharedFilesByDealRoomId, markReadByDealRoom };
