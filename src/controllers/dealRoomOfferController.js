'use strict';

const { errorLogger } = require('../configs/logger');
const dealRoomOfferService = require('../services/dealRoomOfferService');
const HttpResponse = require('../utils/HttpResponse');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getOfferThread = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomOfferService.getOfferThread(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getAllOffers = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomOfferService.getAllOfferThreads(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getCurrentOffer = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomOfferService.getCurrentOffer(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

const getDraft = async (req, res, next) => {
    try {
        const { dealRoomId } = req.params;
        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, { message: 'dealRoomId must be a valid UUID', statusCode: 400 });
        }

        const { userId } = req;
        const result = await dealRoomOfferService.getDraft(dealRoomId, userId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { data: result.data, message: result.message, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        next(error);
    }
};

module.exports = { getOfferThread, getAllOffers, getCurrentOffer, getDraft };
