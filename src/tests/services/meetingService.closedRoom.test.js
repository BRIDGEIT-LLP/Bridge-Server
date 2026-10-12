'use strict';

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };

jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../repositories/meetingRepository', () => ({
    getDealRoomById: jest.fn(),
    createMeeting: jest.fn(),
    getMeetingById: jest.fn(),
    updateMeeting: jest.fn()
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const { sequelize } = require('../../models');
const meetingRepository = require('../../repositories/meetingRepository');
const { createMeeting, updateMeeting } = require('../../services/meetingService');
const { DEAL_ROOM_STATUS, MEETING_MESSAGES } = require('../../utils/constant');

const futureIso = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

const openRoom = {
    id: 'room-1',
    status: DEAL_ROOM_STATUS.ACTIVE,
    requester_user_id: 'user-a',
    recipient_user_id: 'user-b'
};

const closedRoom = { ...openRoom, status: DEAL_ROOM_STATUS.CLOSED };

const existingMeeting = {
    id: 11,
    deal_room_id: 'room-1',
    requester_user_id: 'user-a',
    recipient_user_id: 'user-b',
    created_by: 'user-a',
    title: 'Kickoff'
};

describe('meetingService closed deal room', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(mockTransaction);
    });

    test('createMeeting returns 400 when the deal room is closed', async () => {
        meetingRepository.getDealRoomById.mockResolvedValue(closedRoom);

        const result = await createMeeting({
            dealRoomId: 'room-1',
            recipientUserId: 'user-b',
            title: 'Kickoff',
            agenda: '',
            duration: '30m',
            meetingLink: 'https://meet.example',
            scheduledAt: futureIso(),
            requesterId: 'user-a'
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.message).toBe(MEETING_MESSAGES.DEAL_ROOM_CLOSED);
        expect(meetingRepository.createMeeting).not.toHaveBeenCalled();
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('updateMeeting returns 400 when the deal room is closed', async () => {
        meetingRepository.getMeetingById.mockResolvedValue(existingMeeting);
        meetingRepository.getDealRoomById.mockResolvedValue(closedRoom);

        const result = await updateMeeting({
            meetingId: 11,
            updateData: { title: 'Updated kickoff' },
            userId: 'user-a'
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.message).toBe(MEETING_MESSAGES.DEAL_ROOM_CLOSED);
        expect(meetingRepository.updateMeeting).not.toHaveBeenCalled();
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    test('updateMeeting still writes when the deal room is active', async () => {
        meetingRepository.getMeetingById.mockResolvedValue(existingMeeting);
        meetingRepository.getDealRoomById.mockResolvedValue(openRoom);
        meetingRepository.updateMeeting.mockResolvedValue({ ...existingMeeting, title: 'Updated kickoff' });

        const result = await updateMeeting({
            meetingId: 11,
            updateData: { title: 'Updated kickoff' },
            userId: 'user-a'
        });

        expect(result.success).toBe(true);
        expect(meetingRepository.updateMeeting).toHaveBeenCalled();
        expect(mockTransaction.commit).toHaveBeenCalled();
    });
});
