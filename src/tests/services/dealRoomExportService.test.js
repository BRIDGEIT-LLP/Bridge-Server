'use strict';

jest.mock('../../models', () => ({
    User: { findAll: jest.fn() }
}));

jest.mock('../../repositories/chatRepository', () => ({
    findMergedByDealRoomId: jest.fn()
}));

jest.mock('../../services/chatService', () => ({
    authorize: jest.fn()
}));

jest.mock('../../services/s3.service', () => ({
    getFileStream: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const { User } = require('../../models');
const chatRepository = require('../../repositories/chatRepository');
const chatService = require('../../services/chatService');
const { getFileStream } = require('../../services/s3.service');
const dealRoomExportService = require('../../services/dealRoomExportService');

const mockDealRoom = { id: 'room-1' };

const createArchiveMock = () => ({
    append: jest.fn(),
    finalize: jest.fn().mockResolvedValue()
});

describe('dealRoomExportService.authorizeExport', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns success with the resolved deal room when the caller is a participant', async () => {
        chatService.authorize.mockResolvedValue({ dealRoom: mockDealRoom });

        const result = await dealRoomExportService.authorizeExport('room-1', 42);

        expect(result.success).toBe(true);
        expect(result.data.dealRoom).toBe(mockDealRoom);
    });

    test('passes through the error when the deal room is not found', async () => {
        const notFoundError = { success: false, message: 'Deal room not found', statusCode: 404, data: [] };
        chatService.authorize.mockResolvedValue({ error: notFoundError });

        const result = await dealRoomExportService.authorizeExport('missing-room', 42);

        expect(result).toBe(notFoundError);
    });

    test('passes through the error when the caller is not a participant', async () => {
        const forbiddenError = { success: false, message: 'You are not authorized to access this deal room chat', statusCode: 403, data: [] };
        chatService.authorize.mockResolvedValue({ error: forbiddenError });

        const result = await dealRoomExportService.authorizeExport('room-1', 999);

        expect(result).toBe(forbiddenError);
    });
});

describe('dealRoomExportService.streamExport', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        User.findAll.mockResolvedValue([
            { id: 1, first_name: 'Jane', last_name: 'Doe' },
            { id: 2, first_name: 'John', last_name: 'Smith' }
        ]);
    });

    test('writes one messages.txt per stage and one media entry per attachment', async () => {
        chatRepository.findMergedByDealRoomId.mockResolvedValue([
            {
                id: 1, sender_user_id: 1, message: 'Hello', message_type: 'TEXT',
                stage: 'Initial Connection', created_at: '2026-07-01T10:00:00Z'
            },
            {
                id: 2, sender_user_id: 2, message: 'Can we discuss the ticket size?', message_type: 'TEXT',
                stage: 'Negotiation', created_at: '2026-07-02T10:00:00Z'
            },
            {
                id: 3, sender_user_id: 1, message: null, message_type: 'DOCUMENT',
                attachment_s3_key: 'dealroom/room-1/chat/1-term-sheet.pdf', attachment_file_name: 'term-sheet.pdf',
                stage: 'Negotiation', created_at: '2026-07-02T10:05:00Z'
            }
        ]);
        getFileStream.mockResolvedValue({ pipe: jest.fn() });

        const archive = createArchiveMock();
        await dealRoomExportService.streamExport(mockDealRoom, archive);

        const appendedNames = archive.append.mock.calls.map(([, options]) => options.name);
        expect(appendedNames).toEqual(expect.arrayContaining([
            'chats/Initial Connection/messages.txt',
            'chats/Negotiation/messages.txt',
            'media/Negotiation/3-term-sheet.pdf'
        ]));
        expect(archive.append).not.toHaveBeenCalledWith(expect.anything(), { name: 'missing_files.txt' });
        expect(archive.finalize).toHaveBeenCalled();
    });

    test('skips attachments that fail to download and records them in missing_files.txt', async () => {
        chatRepository.findMergedByDealRoomId.mockResolvedValue([
            {
                id: 5, sender_user_id: 1, message: null, message_type: 'IMAGE',
                attachment_s3_key: 'dealroom/room-1/chat/broken.png', attachment_file_name: 'broken.png',
                stage: 'Due Diligence', created_at: '2026-07-03T10:00:00Z'
            }
        ]);
        getFileStream.mockRejectedValue(new Error('NoSuchKey'));

        const archive = createArchiveMock();
        await dealRoomExportService.streamExport(mockDealRoom, archive);

        const missingCall = archive.append.mock.calls.find(([, options]) => options.name === 'missing_files.txt');
        expect(missingCall).toBeDefined();
        expect(missingCall[0]).toContain('broken.png');
        expect(missingCall[0]).toContain('NoSuchKey');
        expect(archive.finalize).toHaveBeenCalled();
    });

    test('groups rows without a stage value into an Unassigned folder', async () => {
        chatRepository.findMergedByDealRoomId.mockResolvedValue([
            { id: 9, sender_user_id: 1, message: 'legacy row', message_type: 'TEXT', stage: null, created_at: '2026-06-01T10:00:00Z' }
        ]);

        const archive = createArchiveMock();
        await dealRoomExportService.streamExport(mockDealRoom, archive);

        const appendedNames = archive.append.mock.calls.map(([, options]) => options.name);
        expect(appendedNames).toContain('chats/Unassigned/messages.txt');
    });
});
