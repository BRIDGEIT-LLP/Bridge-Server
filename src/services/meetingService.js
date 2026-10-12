'use strict';

const { sequelize } = require('../models');
const meetingRepository = require('../repositories/meetingRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { MEETING_MESSAGES, DEAL_ROOM_STATUS } = require('../utils/constant');

// ─── Create Meeting ───────────────────────────────────────────────────────────

const createMeeting = async ({
    dealRoomId,
    recipientUserId,
    title,
    agenda,
    duration,
    meetingLink,
    scheduledAt,
    requesterId
}) => {
    const transaction = await sequelize.transaction();
    try {
        // 1. Deal room must exist
        const dealRoom = await meetingRepository.getDealRoomById(dealRoomId);
        if (!dealRoom) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        if (dealRoom.status !== DEAL_ROOM_STATUS.ACTIVE) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_CLOSED, statusCode: 400 });
        }

        // 2. Logged-in user must be a participant in this deal room
        const isRequesterParticipant =
            dealRoom.requester_user_id === requesterId ||
            dealRoom.recipient_user_id === requesterId;
        if (!isRequesterParticipant) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.NOT_DEAL_ROOM_PARTICIPANT, statusCode: 403 });
        }

        // 3. The recipient must be the other participant in this deal room
        const isRecipientParticipant =
            dealRoom.requester_user_id === recipientUserId ||
            dealRoom.recipient_user_id === recipientUserId;
        if (!isRecipientParticipant) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.RECIPIENT_MISMATCH, statusCode: 400 });
        }

        // 4. A user cannot schedule a meeting with themselves
        if (requesterId === recipientUserId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.RECIPIENT_MISMATCH, statusCode: 400 });
        }

        // 5. Server-side future date guard (Joi already enforces this; this is a safety net)
        const scheduledDate = new Date(scheduledAt);
        if (scheduledDate <= new Date()) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.PAST_TIME, statusCode: 400 });
        }

        // 6. Create the meeting record
        const meeting = await meetingRepository.createMeeting(
            {
                deal_room_id: dealRoomId,
                requester_user_id: requesterId,
                recipient_user_id: recipientUserId,
                title,
                agenda: agenda || null,
                duration,
                meeting_link: meetingLink,
                scheduled_at: scheduledDate,
                created_by: requesterId
            },
            { transaction }
        );

        await transaction.commit();
        return ServiceResponse.success({
            message: MEETING_MESSAGES.CREATE_SUCCESS,
            data: {
                meetingId: meeting.id,
                id: meeting.id,
                dealRoomId: meeting.deal_room_id,
                requesterUserId: meeting.requester_user_id,
                recipientUserId: meeting.recipient_user_id,
                title: meeting.title,
                agenda: meeting.agenda,
                duration: meeting.duration,
                meetingLink: meeting.meeting_link,
                scheduledAt: meeting.scheduled_at,
                createdBy: meeting.created_by
            },
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: MEETING_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

// ─── Get All Meetings for a Deal Room ────────────────────────────────────────

const getMeetingsByDealRoom = async ({ dealRoomId, userId }) => {
    try {
        const dealRoom = await meetingRepository.getDealRoomById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        const isParticipant =
            dealRoom.requester_user_id === userId ||
            dealRoom.recipient_user_id === userId;
        if (!isParticipant) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const meetings = await meetingRepository.getMeetingsByDealRoom(dealRoomId);
        return ServiceResponse.success({
            message: MEETING_MESSAGES.FETCH_SUCCESS,
            data: meetings,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Get Nearest Upcoming Meeting for a Deal Room ────────────────────────────

const getUpcomingMeeting = async ({ dealRoomId, userId }) => {
    try {
        const dealRoom = await meetingRepository.getDealRoomById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }

        const isParticipant =
            dealRoom.requester_user_id === userId ||
            dealRoom.recipient_user_id === userId;
        if (!isParticipant) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const meeting = await meetingRepository.getUpcomingMeetingByDealRoom(dealRoomId);
        return ServiceResponse.success({
            message: MEETING_MESSAGES.FETCH_SUCCESS,
            data: meeting,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Get Single Meeting by ID ─────────────────────────────────────────────────

const getMeetingById = async ({ meetingId, userId }) => {
    try {
        const meeting = await meetingRepository.getMeetingById(meetingId);
        if (!meeting) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        if (meeting.requester_user_id !== userId && meeting.recipient_user_id !== userId) {
            return ServiceResponse.error({ message: MEETING_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        return ServiceResponse.success({
            message: MEETING_MESSAGES.FETCH_SUCCESS,
            data: meeting,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: MEETING_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Update Meeting ───────────────────────────────────────────────────────────

const updateMeeting = async ({ meetingId, updateData, userId }) => {
    const transaction = await sequelize.transaction();
    try {
        const meeting = await meetingRepository.getMeetingById(meetingId);
        if (!meeting) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        if (meeting.requester_user_id !== userId && meeting.recipient_user_id !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        if (meeting.created_by !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const dealRoom = await meetingRepository.getDealRoomById(meeting.deal_room_id);
        if (!dealRoom) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }
        if (dealRoom.status !== DEAL_ROOM_STATUS.ACTIVE) {
            await transaction.rollback();
            return ServiceResponse.error({ message: MEETING_MESSAGES.DEAL_ROOM_CLOSED, statusCode: 400 });
        }

        // Build snake_case DB payload from camelCase request body
        const dbUpdateData = { updated_by: userId };

        if (updateData.title !== undefined)    dbUpdateData.title = updateData.title;
        if (updateData.agenda !== undefined)   dbUpdateData.agenda = updateData.agenda;
        if (updateData.duration !== undefined) dbUpdateData.duration = updateData.duration;
        if (updateData.meetingLink !== undefined) dbUpdateData.meeting_link = updateData.meetingLink;

        if (updateData.scheduledAt !== undefined) {
            const scheduledDate = new Date(updateData.scheduledAt);
            if (scheduledDate <= new Date()) {
                await transaction.rollback();
                return ServiceResponse.error({ message: MEETING_MESSAGES.PAST_TIME, statusCode: 400 });
            }
            dbUpdateData.scheduled_at = scheduledDate;
        }

        const updatedMeeting = await meetingRepository.updateMeeting(dbUpdateData, meetingId, { transaction });
        await transaction.commit();

        return ServiceResponse.success({
            message: MEETING_MESSAGES.UPDATE_SUCCESS,
            data: updatedMeeting,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: MEETING_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

module.exports = {
    createMeeting,
    getMeetingsByDealRoom,
    getUpcomingMeeting,
    getMeetingById,
    updateMeeting
};