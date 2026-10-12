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
    getSwitchRoleDetails: jest.fn(),
    getUserCompanyRoleByCode: jest.fn(),
    submitRoleSwitchRequest: jest.fn()
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

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const authService = require('../../services/authService');
const userService = require('../../services/userService');
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

describe('authController.getSwitchRoleDetails', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns the target-role fields without allocating a company_user_role row', async () => {
        const fields = [
            { fieldName: 'first_name', isFilled: true, isRequired: true },
            { fieldName: 'investor_type', isFilled: false, isRequired: true }
        ];
        authService.getSwitchRoleDetails.mockResolvedValue({
            success: true,
            message: ROLE_SWITCH_MESSAGES.DETAILS_SUCCESS,
            data: {
                roleId: 5,
                roleCode: 'INVESTOR',
                status: null,
                isProfileCompleted: false,
                rejectionReason: null,
                fields
            }
        });

        const req = { userId: 'user-1', companyId: 'company-1', query: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.getSwitchRoleDetails(req, res);

        expect(authService.getSwitchRoleDetails).toHaveBeenCalledWith('user-1', 'company-1', 'INVESTOR');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            data: expect.objectContaining({ status: null, fields })
        }));
    });

    test('propagates ROLE_NOT_FOUND from the service', async () => {
        authService.getSwitchRoleDetails.mockResolvedValue({
            success: false, message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 400
        });

        const req = { userId: 'user-1', companyId: 'company-1', query: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.getSwitchRoleDetails(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: USER_MESSAGES.ROLE_NOT_FOUND
        }));
    });
});

describe('authController.requestRoleSwitch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authService.getUserCompanyRoleByCode.mockResolvedValue({ success: true, data: null });
        userService.updateUserProfile.mockResolvedValue({ success: true, data: { user: { id: 'user-1' } } });
        authService.submitRoleSwitchRequest.mockResolvedValue({
            success: true,
            message: ROLE_SWITCH_MESSAGES.REQUEST_SUCCESS,
            data: { status: KYC_STATUS.PENDING, isProfileCompleted: true },
            statusCode: 201
        });
    });

    test('saves profile fields then creates a pending completed company_user_role', async () => {
        const req = {
            userId: 'user-1',
            companyId: 'company-1',
            body: { roleCode: 'INVESTOR', investor_type: 'Angel' }
        };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(userService.updateUserProfile).toHaveBeenCalledWith(
            { investor_type: 'Angel' },
            'user-1',
            'company-1'
        );
        expect(authService.submitRoleSwitchRequest).toHaveBeenCalledWith('user-1', 'company-1', 'INVESTOR');
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: true,
            message: ROLE_SWITCH_MESSAGES.REQUEST_SUCCESS,
            data: { status: KYC_STATUS.PENDING, isProfileCompleted: true }
        }));
    });

    test('skips the profile update when only roleCode is sent', async () => {
        const req = { userId: 'user-1', companyId: 'company-1', body: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(userService.updateUserProfile).not.toHaveBeenCalled();
        expect(authService.submitRoleSwitchRequest).toHaveBeenCalled();
    });

    test('does not write a row when required fields are still missing', async () => {
        const missingFields = [{ fieldName: 'investor_type', isRequired: true }];
        authService.submitRoleSwitchRequest.mockResolvedValue({
            success: false,
            message: USER_MESSAGES.PROFILE_NOT_COMPLETED,
            statusCode: 400,
            data: { missingFields }
        });

        const req = { userId: 'user-1', companyId: 'company-1', body: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            data: { missingFields }
        }));
    });

    test('returns pending-approval without saving when the row is already completed', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { status: KYC_STATUS.PENDING, is_profile_completed: true }
        });

        const req = {
            userId: 'user-1',
            companyId: 'company-1',
            body: { roleCode: 'INVESTOR', investor_type: 'Angel' }
        };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(userService.updateUserProfile).not.toHaveBeenCalled();
        expect(authService.submitRoleSwitchRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: USER_MESSAGES.PROFILE_PENDING_APPROVAL
        }));
    });

    test('returns the rejection reason without saving', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { status: KYC_STATUS.REJECTED, rejection_reason: 'Invalid PAN', is_profile_completed: true }
        });

        const req = { userId: 'user-1', companyId: 'company-1', body: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(userService.updateUserProfile).not.toHaveBeenCalled();
        expect(authService.submitRoleSwitchRequest).not.toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            success: false,
            message: 'Invalid PAN',
            data: { status: KYC_STATUS.REJECTED, rejectionReason: 'Invalid PAN' }
        }));
    });

    test('refuses a second request when the role is already approved', async () => {
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { status: KYC_STATUS.APPROVED, is_profile_completed: true }
        });

        const req = { userId: 'user-1', companyId: 'company-1', body: { roleCode: 'INVESTOR' } };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(authService.submitRoleSwitchRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            message: ROLE_SWITCH_MESSAGES.ALREADY_APPROVED
        }));
    });

    test('propagates a profile-save failure without submitting the role row', async () => {
        userService.updateUserProfile.mockResolvedValue({
            success: false, message: USER_MESSAGES.UPDATE_FAILED, statusCode: 500
        });

        const req = {
            userId: 'user-1',
            companyId: 'company-1',
            body: { roleCode: 'INVESTOR', investor_type: 'Angel' }
        };
        const res = createRes();
        await authController.requestRoleSwitch(req, res);

        expect(authService.submitRoleSwitchRequest).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(500);
    });
});
