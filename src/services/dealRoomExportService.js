'use strict';

const { User } = require('../models');
const { errorLogger } = require('../configs/logger');
const chatRepository = require('../repositories/chatRepository');
const chatService = require('./chatService');
const { getFileStream } = require('./s3.service');
const ServiceResponse = require('../utils/ServiceResponse');
const { CHAT_MESSAGE_TYPE, CHAT_MESSAGES, DEAL_ROOM_STAGES } = require('../utils/constant');

const UNASSIGNED_STAGE = 'Unassigned';
const STAGE_ORDER = Object.values(DEAL_ROOM_STAGES);

const sanitizeFileName = (fileName) => (fileName || 'file').replace(/["\r\n\\/]/g, '_');

const formatTimestamp = (date) => new Date(date).toISOString().replace('T', ' ').substring(0, 19);

const formatLine = (item, senderById) => {
    const sender = senderById.get(item.sender_user_id);
    const senderName = sender ? `${sender.first_name} ${sender.last_name}` : `User #${item.sender_user_id}`;
    const timestamp = formatTimestamp(item.created_at);

    if (item.message_type === CHAT_MESSAGE_TYPE.TEXT) {
        return `[${timestamp}] ${senderName}: ${item.message}`;
    }

    const captionSuffix = item.message ? ` - ${item.message}` : '';
    return `[${timestamp}] ${senderName}: [Media: ${item.attachment_file_name}]${captionSuffix}`;
};

const groupByStage = (items) => {
    const groups = new Map();
    for (const item of items) {
        const stage = item.stage || UNASSIGNED_STAGE;
        if (!groups.has(stage)) {
            groups.set(stage, []);
        }
        groups.get(stage).push(item);
    }
    return groups;
};

const orderedStages = (groups) => {
    const known = STAGE_ORDER.filter((stage) => groups.has(stage));
    const unknown = [...groups.keys()].filter((stage) => !STAGE_ORDER.includes(stage)).sort();
    return [...known, ...unknown];
};

const authorizeExport = async (dealRoomId, userId) => {
    const { dealRoom, error } = await chatService.authorize(dealRoomId, userId);
    if (error) {
        return error;
    }
    return ServiceResponse.success({ data: { dealRoom } });
};

const streamExport = async (dealRoom, archive) => {
    const items = await chatRepository.findMergedByDealRoomId(dealRoom.id);

    const senderIds = [...new Set(items.map((item) => item.sender_user_id))];
    const senders = await User.findAll({
        where: { id: senderIds },
        attributes: ['id', 'first_name', 'last_name']
    });
    const senderById = new Map(senders.map((sender) => [sender.id, sender]));

    const groups = groupByStage(items);
    const missingFiles = [];

    for (const stage of orderedStages(groups)) {
        const stageItems = groups.get(stage);

        const transcript = stageItems.map((item) => formatLine(item, senderById)).join('\n');
        archive.append(transcript, { name: `chats/${stage}/messages.txt` });

        const mediaItems = stageItems.filter((item) => item.message_type !== CHAT_MESSAGE_TYPE.TEXT);
        for (const item of mediaItems) {
            try {
                const stream = await getFileStream(item.attachment_s3_key);
                archive.append(stream, { name: `media/${stage}/${item.id}-${sanitizeFileName(item.attachment_file_name)}` });
            } catch (error) {
                errorLogger.error(error);
                missingFiles.push({ stage, id: item.id, fileName: item.attachment_file_name, reason: error.message });
            }
        }
    }

    if (missingFiles.length) {
        const missingFilesContent = missingFiles
            .map(({ stage, id, fileName, reason }) => `${stage} | ${id} | ${fileName} | ${reason}`)
            .join('\n');
        archive.append(missingFilesContent, { name: 'missing_files.txt' });
    }

    await archive.finalize();
};

module.exports = { authorizeExport, streamExport };
