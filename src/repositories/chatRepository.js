'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, DealRoomMessage } = require('../models');

const create = async (data, { transaction } = {}) => {
    return await DealRoomMessage.create(data, { transaction });
};

// Merges the full deal_room_message + deal_room_media history for a room via
// a single UNION ALL — the database does the sort, no app-level merge needed.
// The output columns are named to reproduce the pre-split deal_room_message
// row shape (message / message_type on every row) so the API response is
// unchanged regardless of which table a row actually lives in.
const findMergedByDealRoomId = async (dealRoomId) => {
    return await sequelize.query(
        `SELECT * FROM (
            SELECT
                id, deal_room_id, sender_user_id, sender_role_id, recipient_user_id, recipient_role_id,
                message, 'TEXT'::varchar AS message_type,
                NULL::varchar AS attachment_s3_key, NULL::varchar AS attachment_file_name,
                NULL::varchar AS attachment_mime_type, NULL::integer AS attachment_file_size,
                NULL::boolean AS download_allowed, NULL::boolean AS view_only,
                read_at, stage, created_at
            FROM deal_room_message
            WHERE deal_room_id = :dealRoomId AND is_deleted = false

            UNION ALL

            SELECT
                id, deal_room_id, sender_user_id, sender_role_id, recipient_user_id, recipient_role_id,
                caption AS message, media_type AS message_type,
                attachment_s3_key, attachment_file_name, attachment_mime_type, attachment_file_size,
                download_allowed, view_only,
                read_at, stage, created_at
            FROM deal_room_media
            WHERE deal_room_id = :dealRoomId AND is_deleted = false
        ) chat_timeline
        ORDER BY created_at ASC, id ASC`,
        {
            replacements: { dealRoomId },
            type: QueryTypes.SELECT
        }
    );
};

const markReadByDealRoom = async (dealRoomId, readerUserId, readAt, { transaction } = {}) => {
    const [count] = await DealRoomMessage.update(
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

module.exports = { create, findMergedByDealRoomId, markReadByDealRoom };
