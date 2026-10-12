'use strict';

const { errorLogger } = require('../configs/logger');
const chatService = require('../services/chatService');
const { emitToDealRoom } = require('../sockets');
const { SOCKET_EVENTS, CHAT_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const parseDealRoomId = (req, res) => {
    const { dealRoomId } = req.params;
    if (!UUID_REGEX.test(dealRoomId)) {
        HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        return null;
    }
    return dealRoomId;
};

const sanitizeFileName = (fileName) => (fileName || 'file').replace(/["\r\n]/g, '');

const getMessages = async (req, res, next) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const { userId } = req;

        const result = await chatService.getMessages(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getSharedFiles = async (req, res, next) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const { userId } = req;

        const result = await chatService.getSharedFiles(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const markRead = async (req, res, next) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const { userId } = req;

        const result = await chatService.markRead(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        emitToDealRoom(dealRoomId, SOCKET_EVENTS.MESSAGES_READ, { dealRoomId, readBy: userId });

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const uploadMedia = async (req, res, next) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const { download_allowed, view_only } = req.body;

        if (!req.file) {
            return HttpResponse.error(res, { message: CHAT_MESSAGES.MEDIA_REQUIRED, statusCode: 400 });
        }

        const { userId, roleId, companyId } = req;
        const { caption } = req.body;

        const result = await chatService.sendMediaMessage({
            dealRoomId,
            senderUserId: userId,
            senderRoleId: roleId,
            senderCompanyId: companyId,
            file: req.file,
            caption,
            download_allowed, 
            view_only
        });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        emitToDealRoom(dealRoomId, SOCKET_EVENTS.NEW_MESSAGE, result.data);

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getMedia = async (req, res, next) => {
    try {
        const dealRoomId = parseDealRoomId(req, res);
        if (!dealRoomId) return;

        const messageId = Number(req.params.messageId);
        if (!Number.isInteger(messageId) || messageId <= 0) {
            return HttpResponse.error(res, { message: 'messageId must be a positive integer', statusCode: 400 });
        }

        const { userId } = req;

        const result = await chatService.getMedia(dealRoomId, messageId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        const { buffer, mimeType, fileName } = result.data;
        res.setHeader('Content-Type', mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `inline; filename="${sanitizeFileName(fileName)}"`);
        return res.send(buffer);
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

module.exports = { getMessages, getSharedFiles, markRead, uploadMedia, getMedia };
