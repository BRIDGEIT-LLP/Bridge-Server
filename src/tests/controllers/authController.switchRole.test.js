'use strict';

jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

jest.mock('../../services/authService', () => ({
    getUserCompanyRoleByCode: jest.fn(),
    allocateUserCompanyRole: jest.fn(),
    getCompanyAndUser: jest.fn(),
    getProfileFieldsConfig: jest.fn(),
    validateAvailableProfileFields: jest.fn()
}));

jest.mock('../../services/userService', () => ({
    updateUserProfile: jest.fn()
}));

jest.mock('../../services/tokenService', () => ({
    generateTokens: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

// otpService (required transitively by authController) opens a real ioredis
// connection on require, which keeps the Jest process alive after assertions
// finish — same workaround as src/tests/routes/adminRoutes.test.js.
jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const authService = require('../../services/authService');
const tokenService = require('../../services/tokenService');
const authController = require('../../controllers/authController');
const { ROLE_SWITCH_MESSAGES, USER_MESSAGES, KYC_STATUS } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const createReq = (overrides = {}) => ({
    userId: 'user-1',
    companyId: 'company-1',
    body: { roleCode: 'INVESTOR' },
    ip: '127.0.0.1',
    headers: {},
    ...overrides
});

const company = { id: 'company-1' };
const user = { id: 'user-1' };

describe('authController.switchRole', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authService.getCompanyAndUser.mockResolvedValue({ success: true, data: { company, user } });
    });

    test('reuses an existing approved role and issues fresh tokens without allocating', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: {
                role_id: 5,
                role_code: 'INVESTOR',
                status: KYC_STATUS.APPROVED,
                is_profile_completed: true
            }
        });
        tokenService.generateTokens.mockResolvedValue({
            data: { accessToken: 'at', refreshToken: 'rt' }
        });

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(authService.allocateUserCompanyRole).not.toHaveBeenCalled();
        expect(res.cookie).toHaveBeenCalledTimes(2);
        expect(res.status).not.toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: { roleId: 5, role: 'INVESTOR' }
        }));
    });

    test('returns 400 NOT_REQUESTED when the user has no company_user_role for the target', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({ success: true, data: null });

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(authService.allocateUserCompanyRole).not.toHaveBeenCalled();
        expect(tokenService.generateTokens).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: ROLE_SWITCH_MESSAGES.NOT_REQUESTED
        }));
    });

    test('returns 400 when the target-role profile is not completed', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { role_id: 5, role_code: 'INVESTOR', status: 'Pending', is_profile_completed: false }
        });

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: USER_MESSAGES.PROFILE_NOT_COMPLETED
        }));
        expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    test('returns the rejection reason (200) for a rejected role without issuing tokens', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: {
                role_id: 5,
                role_code: 'INVESTOR',
                status: KYC_STATUS.REJECTED,
                rejection_reason: 'Invalid PAN',
                is_profile_completed: true
            }
        });

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Invalid PAN',
            data: { status: KYC_STATUS.REJECTED, rejectionReason: 'Invalid PAN' }
        }));
        expect(tokenService.generateTokens).not.toHaveBeenCalled();
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test('returns pending-approval (200) for a completed role that is neither approved nor rejected', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { role_id: 5, role_code: 'INVESTOR', status: 'Pending', is_profile_completed: true }
        });

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: USER_MESSAGES.PROFILE_PENDING_APPROVAL,
            data: { status: 'Pending' }
        }));
        expect(tokenService.generateTokens).not.toHaveBeenCalled();
    });

    test('returns a neutral SWITCH_FAILED 500 (not AUTH_MESSAGES.UNAUTHORIZED) on an unexpected error', async () => {
        authService.getUserCompanyRoleByCode.mockRejectedValue(new Error('connection terminated'));

        const req = createReq();
        const res = createRes();
        await authController.switchRole(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: ROLE_SWITCH_MESSAGES.SWITCH_FAILED
        }));
    });
});
