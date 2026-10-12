'use strict';

const { errorLogger } = require('../configs/logger');
const meetingService = require('../services/meetingService');
const { MEETING_MESSAGES, SOCKET_EVENTS } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { emitToDealRoom } = require('../sockets');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Create Meeting ───────────────────────────────────────────────────────────

const createMeeting = async (req, res, next) => {
    try {
        const requesterId = req.userId;
        const { dealRoomId, recipientUserId, title, agenda, duration, meetingLink, scheduledAt } = req.body;

        const response = await meetingService.createMeeting({
            dealRoomId,
            recipientUserId,
            title,
            agenda,
            duration,
            meetingLink,
            scheduledAt,
            requesterId
        });

        if (!response.success) {
            return HttpResponse.error(res, {
                message: response.message,
                data: response.data,
                statusCode: response.statusCode
            });
        }

        // Let the counterparty (and my other tabs) see the new meeting live, without
        // needing to poll/refresh — mirrors the chat NEW_MESSAGE broadcast pattern.
        emitToDealRoom(dealRoomId, SOCKET_EVENTS.MEETING_SCHEDULED, response.data);

        return HttpResponse.success(res, {
            message: response.message,
            data: response.data,
            statusCode: response.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: MEETING_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

// ─── Get All Meetings for a Deal Room ────────────────────────────────────────
// GET /api/v1/meetings?dealRoomId=<uuid>

const getMeetingsByDealRoom = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { dealRoomId } = req.query;

        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, {
                message: 'dealRoomId query parameter is required and must be a valid UUID',
                statusCode: 400
            });
        }

        const response = await meetingService.getMeetingsByDealRoom({ dealRoomId, userId });

        if (!response.success) {
            return HttpResponse.error(res, {
                message: response.message,
                data: response.data,
                statusCode: response.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: response.message,
            data: response.data,
            statusCode: response.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Get Nearest Upcoming Meeting for a Deal Room ────────────────────────────
// GET /api/v1/meetings/upcoming?dealRoomId=<uuid>

const getUpcomingMeeting = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { dealRoomId } = req.query;

        if (!UUID_REGEX.test(dealRoomId)) {
            return HttpResponse.error(res, {
                message: 'dealRoomId query parameter is required and must be a valid UUID',
                statusCode: 400
            });
        }

        const response = await meetingService.getUpcomingMeeting({ dealRoomId, userId });

        if (!response.success) {
            return HttpResponse.error(res, {
                message: response.message,
                data: response.data,
                statusCode: response.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: response.message,
            data: response.data,
            statusCode: response.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Get Single Meeting by ID ─────────────────────────────────────────────────
// GET /api/v1/meetings/detail?meetingId=1

const getMeetingById = async (req, res, next) => {
    try {
        const userId = req.userId;
        const meetingId = parseInt(req.query.meetingId, 10);

        if (!req.query.meetingId || isNaN(meetingId) || meetingId <= 0) {
            return HttpResponse.error(res, {
                message: 'meetingId query parameter is required and must be a positive integer',
                statusCode: 400
            });
        }

        const response = await meetingService.getMeetingById({ meetingId, userId });

        if (!response.success) {
            return HttpResponse.error(res, {
                message: response.message,
                data: response.data,
                statusCode: response.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: response.message,
            data: response.data,
            statusCode: response.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Update Meeting ───────────────────────────────────────────────────────────
// PUT /api/v1/meetings/update?meetingId=1

const updateMeeting = async (req, res, next) => {
    try {
        const userId = req.userId;
        const meetingId = parseInt(req.query.meetingId, 10);
        const updateData = req.body;

        if (!req.query.meetingId || isNaN(meetingId) || meetingId <= 0) {
            return HttpResponse.error(res, {
                message: 'meetingId query parameter is required and must be a positive integer',
                statusCode: 400
            });
        }

        const response = await meetingService.updateMeeting({ meetingId, updateData, userId });

        if (!response.success) {
            return HttpResponse.error(res, {
                message: response.message,
                data: response.data,
                statusCode: response.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: response.message,
            data: response.data,
            statusCode: response.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, { message: MEETING_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

module.exports = {
    createMeeting,
    getMeetingsByDealRoom,
    getUpcomingMeeting,
    getMeetingById,
    updateMeeting
};