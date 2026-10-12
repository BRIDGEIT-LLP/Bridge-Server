'use strict';

jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() },
    accessLogger: { info: jest.fn() }
}));

jest.mock('../../repositories/companyRepository', () => ({
    findCompanyUserRoleById: jest.fn(),
    updateCompanyUserRoleStatus: jest.fn()
}));

const companyRepository = require('../../repositories/companyRepository');
const adminService = require('../../services/adminService');
const { ROLE_SWITCH_MESSAGES, KYC_STATUS } = require('../../utils/constant');

describe('adminService.updateRoleSwitchStatus', () => {
    const adminId = 'admin-1';
    const companyUserRoleId = 12;

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns 404 when the switch-role row does not exist', async () => {
        companyRepository.findCompanyUserRoleById.mockResolvedValue(null);

        const result = await adminService.updateRoleSwitchStatus({
            companyUserRoleId, action: 'approve', adminId
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(404);
        expect(result.message).toBe(ROLE_SWITCH_MESSAGES.NOT_FOUND);
        expect(companyRepository.updateCompanyUserRoleStatus).not.toHaveBeenCalled();
    });

    test('refuses approve when the target-role profile is incomplete', async () => {
        companyRepository.findCompanyUserRoleById.mockResolvedValue({
            id: companyUserRoleId, is_profile_completed: false
        });

        const result = await adminService.updateRoleSwitchStatus({
            companyUserRoleId, action: 'approve', adminId
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.message).toBe(ROLE_SWITCH_MESSAGES.PROFILE_NOT_COMPLETED);
        expect(companyRepository.updateCompanyUserRoleStatus).not.toHaveBeenCalled();
    });

    test('refuses reject when the target-role profile is incomplete', async () => {
        companyRepository.findCompanyUserRoleById.mockResolvedValue({
            id: companyUserRoleId, is_profile_completed: false
        });

        const result = await adminService.updateRoleSwitchStatus({
            companyUserRoleId, action: 'reject', rejectionReason: 'Not ready', adminId
        });

        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(400);
        expect(result.message).toBe(ROLE_SWITCH_MESSAGES.PROFILE_NOT_COMPLETED);
        expect(companyRepository.updateCompanyUserRoleStatus).not.toHaveBeenCalled();
    });

    test('approves a completed profile without rewriting is_profile_completed', async () => {
        companyRepository.findCompanyUserRoleById.mockResolvedValue({
            id: companyUserRoleId, is_profile_completed: true
        });
        companyRepository.updateCompanyUserRoleStatus.mockResolvedValue({
            id: companyUserRoleId, status: KYC_STATUS.APPROVED
        });

        const result = await adminService.updateRoleSwitchStatus({
            companyUserRoleId, action: 'approve', adminId
        });

        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(companyRepository.updateCompanyUserRoleStatus).toHaveBeenCalledWith(
            companyUserRoleId,
            expect.objectContaining({
                status: KYC_STATUS.APPROVED,
                rejection_reason: null,
                approved_by: adminId
            })
        );
        expect(companyRepository.updateCompanyUserRoleStatus.mock.calls[0][1])
            .not.toHaveProperty('is_profile_completed');
    });

    test('rejects a completed profile with the supplied reason', async () => {
        companyRepository.findCompanyUserRoleById.mockResolvedValue({
            id: companyUserRoleId, is_profile_completed: true
        });
        companyRepository.updateCompanyUserRoleStatus.mockResolvedValue({
            id: companyUserRoleId, status: KYC_STATUS.REJECTED
        });

        const result = await adminService.updateRoleSwitchStatus({
            companyUserRoleId, action: 'reject', rejectionReason: 'Missing docs', adminId
        });

        expect(result.success).toBe(true);
        expect(companyRepository.updateCompanyUserRoleStatus).toHaveBeenCalledWith(
            companyUserRoleId,
            expect.objectContaining({
                status: KYC_STATUS.REJECTED,
                rejection_reason: 'Missing docs'
            })
        );
    });
});
