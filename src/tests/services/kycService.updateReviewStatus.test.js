'use strict';

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };

jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../repositories/kycInfoRepository', () => ({
    findKycRecord: jest.fn(),
    findAllKycRecords: jest.fn()
}));

jest.mock('../../repositories/companyRepository', () => ({
    getCompanyById: jest.fn(),
    updateKycStatus: jest.fn(),
    incrementKycRejectionCount: jest.fn(),
    getCompanyUser: jest.fn(),
    markDefaultProfileCompleted: jest.fn(),
    markKycUploaded: jest.fn()
}));

jest.mock('../../repositories/userRepository', () => ({
    updateUser: jest.fn()
}));

jest.mock('../../repositories/userLimitConfigRepository', () => ({
    createDefaultUserLimitConfig: jest.fn()
}));

jest.mock('../../services/adminConfigService', () => ({
    getTrialConfigValue: jest.fn()
}));

jest.mock('../../services/emailBlockService', () => ({
    getRejectionLimit: jest.fn(),
    applyBlock: jest.fn(),
    invalidateSessionCache: jest.fn(),
    checkEmail: jest.fn()
}));

jest.mock('../../utils/encryption', () => ({ decrypt: jest.fn(), encrypt: jest.fn() }));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const { sequelize } = require('../../models');
const companyRepository = require('../../repositories/companyRepository');
const userRepository = require('../../repositories/userRepository');
const emailBlockService = require('../../services/emailBlockService');
const kycService = require('../../services/kycService');
const { KYC_STATUS, BLOCK_REASONS } = require('../../utils/constant');

const baseCompany = (overrides = {}) => ({
    id: 'company-1',
    company_email: 'Founder@Acme.io',
    kyc_status: KYC_STATUS.PENDING,
    kyc_rejection_count: 0,
    ...overrides
});

const reject = () => kycService.updateReviewStatus({
    companyId: 'company-1', action: 'reject', rejectionReason: 'blurry', adminId: 'admin-1'
});

describe('kycService.updateReviewStatus — reject / email block', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(mockTransaction);
        emailBlockService.getRejectionLimit.mockResolvedValue(3);
        companyRepository.getCompanyById.mockResolvedValue(baseCompany());
        companyRepository.updateKycStatus.mockResolvedValue({ id: 'company-1', toJSON: () => ({ id: 'company-1' }) });
        companyRepository.getCompanyUser.mockResolvedValue([{ id: 'user-1' }]);
        companyRepository.incrementKycRejectionCount.mockResolvedValue({ kyc_rejection_count: 1 });
    });

    test('1st rejection: counts, does not block', async () => {
        const res = await reject();

        expect(res.success).toBe(true);
        expect(companyRepository.getCompanyById).toHaveBeenCalledWith('company-1', { transaction: mockTransaction, lock: true });
        expect(companyRepository.incrementKycRejectionCount).toHaveBeenCalledWith('company-1', { transaction: mockTransaction });
        expect(emailBlockService.applyBlock).not.toHaveBeenCalled();
        expect(emailBlockService.invalidateSessionCache).not.toHaveBeenCalled();
        expect(res.data).toMatchObject({ kycRejectionCount: 1, maxRejections: 3, isEmailBlocked: false });
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('limit-reaching rejection: blocks the email and ends sessions, inside the transaction', async () => {
        companyRepository.getCompanyById.mockResolvedValue(baseCompany({ kyc_rejection_count: 2 }));
        companyRepository.incrementKycRejectionCount.mockResolvedValue({ kyc_rejection_count: 3 });

        const res = await reject();

        expect(emailBlockService.applyBlock).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'Founder@Acme.io', companyId: 'company-1', userIds: ['user-1'],
                reason: BLOCK_REASONS.KYC_REJECTED_MAX, blockedBy: 'admin-1', rejectionCount: 3, rejectionLimit: 3
            }),
            { transaction: mockTransaction }
        );
        expect(mockTransaction.commit).toHaveBeenCalled();
        expect(emailBlockService.invalidateSessionCache).toHaveBeenCalledWith(['user-1']);
        expect(res.data).toMatchObject({ kycRejectionCount: 3, isEmailBlocked: true });
    });

    test('honours a configured limit other than 3', async () => {
        emailBlockService.getRejectionLimit.mockResolvedValue(2);
        companyRepository.getCompanyById.mockResolvedValue(baseCompany({ kyc_rejection_count: 1 }));
        companyRepository.incrementKycRejectionCount.mockResolvedValue({ kyc_rejection_count: 2 });

        const res = await reject();

        expect(emailBlockService.applyBlock).toHaveBeenCalledWith(
            expect.objectContaining({ rejectionCount: 2, rejectionLimit: 2 }),
            expect.anything()
        );
        expect(res.data.isEmailBlocked).toBe(true);
    });

    test('rejecting an already-Rejected company does not burn another strike', async () => {
        companyRepository.getCompanyById.mockResolvedValue(baseCompany({ kyc_status: KYC_STATUS.REJECTED, kyc_rejection_count: 2 }));

        const res = await reject();

        expect(companyRepository.incrementKycRejectionCount).not.toHaveBeenCalled();
        expect(emailBlockService.applyBlock).not.toHaveBeenCalled();
        expect(res.data).toMatchObject({ kycRejectionCount: 2, isEmailBlocked: false });
    });

    test('rolls everything back (no commit, no cache action) when applyBlock fails', async () => {
        companyRepository.getCompanyById.mockResolvedValue(baseCompany({ kyc_rejection_count: 2 }));
        companyRepository.incrementKycRejectionCount.mockResolvedValue({ kyc_rejection_count: 3 });
        emailBlockService.applyBlock.mockRejectedValue(new Error('boom'));

        const res = await reject();

        expect(res.success).toBe(false);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
        expect(emailBlockService.invalidateSessionCache).not.toHaveBeenCalled();
    });

    test('returns 404 and rolls back when the company does not exist', async () => {
        companyRepository.getCompanyById.mockResolvedValue(null);

        const res = await reject();

        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(404);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(companyRepository.updateKycStatus).not.toHaveBeenCalled();
    });
});

describe('kycService.updateReviewStatus — approve', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(mockTransaction);
        companyRepository.getCompanyById.mockResolvedValue(baseCompany({ kyc_rejection_count: 2, kyc_status: KYC_STATUS.PENDING }));
        companyRepository.updateKycStatus.mockResolvedValue({ id: 'company-1', toJSON: () => ({ id: 'company-1' }) });
        companyRepository.getCompanyUser.mockResolvedValue([{ id: 'user-1' }]);
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: false } });
    });

    test('does not touch the rejection counter or the block', async () => {
        const res = await kycService.updateReviewStatus({ companyId: 'company-1', action: 'approve', adminId: 'admin-1' });

        expect(res.success).toBe(true);
        expect(emailBlockService.getRejectionLimit).not.toHaveBeenCalled();
        expect(companyRepository.incrementKycRejectionCount).not.toHaveBeenCalled();
        expect(emailBlockService.applyBlock).not.toHaveBeenCalled();
        expect(userRepository.updateUser).toHaveBeenCalledWith({ is_active: true }, 'user-1', expect.objectContaining({ allowPrivileged: true }));
    });

    const approve = () => kycService.updateReviewStatus({ companyId: 'company-1', action: 'approve', adminId: 'admin-1' });

    test('refuses (409) to approve a company whose email is blocked, and changes nothing', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: true } });

        const res = await approve();

        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(409);
        expect(mockTransaction.rollback).toHaveBeenCalled();
        expect(companyRepository.updateKycStatus).not.toHaveBeenCalled();
        expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    test('fails closed when the block lookup errors', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: false, message: 'x', statusCode: 503 });

        const res = await approve();

        expect(res.statusCode).toBe(503);
        expect(companyRepository.updateKycStatus).not.toHaveBeenCalled();
    });
});
