'use strict';

const mockArchiveInstance = {
    on: jest.fn(),
    pipe: jest.fn()
};

jest.mock('archiver', () => jest.fn(() => mockArchiveInstance));

jest.mock('../../services/dealRoomExportService', () => ({
    authorizeExport: jest.fn(),
    streamExport: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const archiver = require('archiver');
const dealRoomExportService = require('../../services/dealRoomExportService');
const dealRoomExportController = require('../../controllers/dealRoomExportController');

const VALID_DEAL_ROOM_ID = '11111111-1111-1111-1111-111111111111';

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.setHeader = jest.fn();
    res.destroy = jest.fn();
    res.headersSent = false;
    return res;
};

describe('dealRoomExportController.exportDealRoom', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects a malformed dealRoomId without calling the service', async () => {
        const req = { params: { dealRoomId: 'not-a-uuid' }, userId: 1 };
        const res = createRes();

        await dealRoomExportController.exportDealRoom(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(dealRoomExportService.authorizeExport).not.toHaveBeenCalled();
    });

    test('returns the authorization error status/message without touching response headers', async () => {
        const req = { params: { dealRoomId: VALID_DEAL_ROOM_ID }, userId: 1 };
        const res = createRes();
        dealRoomExportService.authorizeExport.mockResolvedValue({
            success: false, message: 'You are not authorized to access this deal room chat', statusCode: 403, data: []
        });

        await dealRoomExportController.exportDealRoom(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.setHeader).not.toHaveBeenCalled();
        expect(dealRoomExportService.streamExport).not.toHaveBeenCalled();
    });

    test('streams the zip with the correct headers when authorized', async () => {
        const dealRoom = { id: VALID_DEAL_ROOM_ID };
        const req = { params: { dealRoomId: VALID_DEAL_ROOM_ID }, userId: 1 };
        const res = createRes();
        dealRoomExportService.authorizeExport.mockResolvedValue({ success: true, data: { dealRoom }, statusCode: 200 });
        dealRoomExportService.streamExport.mockResolvedValue();

        await dealRoomExportController.exportDealRoom(req, res);

        expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/zip');
        expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('attachment; filename='));
        expect(archiver).toHaveBeenCalledWith('zip', { zlib: { level: 9 } });
        expect(mockArchiveInstance.pipe).toHaveBeenCalledWith(res);
        expect(dealRoomExportService.streamExport).toHaveBeenCalledWith(dealRoom, mockArchiveInstance);
    });

    test('responds with 500 if an unexpected error is thrown before headers are sent', async () => {
        const req = { params: { dealRoomId: VALID_DEAL_ROOM_ID }, userId: 1 };
        const res = createRes();
        dealRoomExportService.authorizeExport.mockRejectedValue(new Error('boom'));

        await dealRoomExportController.exportDealRoom(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
    });
});
