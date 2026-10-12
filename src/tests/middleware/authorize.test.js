'use strict';

jest.mock('../../services/permissionService', () => ({
    hasPermission: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const permissionService = require('../../services/permissionService');
const authorize = require('../../middleware/authorize');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('authorize middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('calls next() when the userType has the permission', async () => {
        permissionService.hasPermission.mockResolvedValue(true);
        const req = { role: 'STARTUP', userType: 'USER' };
        const res = createRes();
        const next = jest.fn();

        await authorize('DEAL_ROOM.CLOSE')(req, res, next);

        expect(permissionService.hasPermission).toHaveBeenCalledWith('USER', 'DEAL_ROOM.CLOSE');
        expect(next).toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 403 without calling next() when the userType lacks the permission', async () => {
        permissionService.hasPermission.mockResolvedValue(false);
        const req = { role: 'STARTUP', userType: 'USER' };
        const res = createRes();
        const next = jest.fn();

        await authorize('ADMIN_KYC.REVIEW_ACTION')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(next).not.toHaveBeenCalled();
    });

    test('returns 500 without calling next() when the permission check throws', async () => {
        permissionService.hasPermission.mockRejectedValue(new Error('db down'));
        const req = { role: 'STARTUP', userType: 'USER' };
        const res = createRes();
        const next = jest.fn();

        await authorize('DEAL_ROOM.CLOSE')(req, res, next);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(next).not.toHaveBeenCalled();
    });
});
