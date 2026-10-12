'use strict';

const { errorLogger } = require('../configs/logger');
const dealRoomService = require('../services/dealRoomService');
const HttpResponse = require('../utils/HttpResponse');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getDealRooms = async (req, res, next) => {
    try {
        const { userId, roleId } = req;
        const archived = req.query.archived === 'true';

        const result = await dealRoomService.getDealRooms(userId, roleId, { archived });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const archiveDealRoom = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;

        const result = await dealRoomService.archiveDealRoom(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const unarchiveDealRoom = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;

        const result = await dealRoomService.unarchiveDealRoom(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const closeDealRoom = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { reason } = req.body;
        const { userId } = req;

        const result = await dealRoomService.closeDealRoom(dealRoomId, { reason, userId });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getPendingStageUpdate = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;

        const result = await dealRoomService.getPendingStageUpdate(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });

    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

module.exports = { getDealRooms, closeDealRoom, getPendingStageUpdate, archiveDealRoom, unarchiveDealRoom };
