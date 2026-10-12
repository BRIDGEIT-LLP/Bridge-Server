'use strict';

const { errorLogger } = require('../configs/logger');
const dealRoomTermSheetService = require('../services/dealRoomTermSheetService');
const HttpResponse = require('../utils/HttpResponse');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getCurrentTermSheet = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomTermSheetService.getCurrentTermSheet(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getTermSheetHistory = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomTermSheetService.getTermSheetHistory(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

module.exports = { getCurrentTermSheet, getTermSheetHistory };
