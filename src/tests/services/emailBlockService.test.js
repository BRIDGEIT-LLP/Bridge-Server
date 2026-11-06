'use strict';

jest.mock('../../repositories/blockedEmailRepository', () => ({
    findActiveByEmail: jest.fn(),
    createIfNotActive: jest.fn()
}));

jest.mock('../../repositories/userSessionRepository', () => ({
    revokeAllSessionsByUser: jest.fn()
}));

jest.mock('../../repositories/sessionCacheRepository', () => ({
    invalidateUser: jest.fn()
}));

jest.mock('../../services/adminConfigService', () => ({
    getTrialConfigValue: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const blockedEmailRepository = require('../../repositories/blockedEmailRepository');
const userSessionRepository = require('../../repositories/userSessionRepository');
const sessionCacheRepository = require('../../repositories/sessionCacheRepository');
const adminConfigService = require('../../services/adminConfigService');
const emailBlockService = require('../../services/emailBlockService');
const { KYC_STATUS, TRIAL_CONFIG_LOOKUP_KEYS, KYC_REJECTION_LIMITS } = require('../../utils/constant');

describe('emailBlockService.getRejectionLimit', () => {
    beforeEach(() => jest.clearAllMocks());

    test('reads the configured value', async () => {
        adminConfigService.getTrialConfigValue.mockResolvedValue(5);
        await expect(emailBlockService.getRejectionLimit()).resolves.toBe(5);
        expect(adminConfigService.getTrialConfigValue).toHaveBeenCalledWith(
            TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS,
            KYC_REJECTION_LIMITS.DEFAULT_MAX_REJECTIONS
        );
    });

    test.each([[undefined], [null], ['abc'], [0], [-2], [2.5]])(
        'falls back to the default for invalid value %p (never "no limit")',
        async (bad) => {
            adminConfigService.getTrialConfigValue.mockResolvedValue(bad);
            await expect(emailBlockService.getRejectionLimit()).resolves.toBe(KYC_REJECTION_LIMITS.DEFAULT_MAX_REJECTIONS);
        }
    );
});

describe('emailBlockService.checkEmail', () => {
    beforeEach(() => jest.clearAllMocks());

    test('looks up the email as given', async () => {
        blockedEmailRepository.findActiveByEmail.mockResolvedValue(null);
        await emailBlockService.checkEmail('a@b.io');
        expect(blockedEmailRepository.findActiveByEmail).toHaveBeenCalledWith('a@b.io', { transaction: undefined });
    });

    test('reports blocked when an active row exists', async () => {
        const block = { id: 1, email: 'a@b.io' };
        blockedEmailRepository.findActiveByEmail.mockResolvedValue(block);
        const res = await emailBlockService.checkEmail('a@b.io');
        expect(res.success).toBe(true);
        expect(res.data).toEqual({ blocked: true, block });
    });

    test('reports not blocked (e.g. only a soft-deleted row exists)', async () => {
        blockedEmailRepository.findActiveByEmail.mockResolvedValue(null);
        const res = await emailBlockService.checkEmail('a@b.io');
        expect(res.data.blocked).toBe(false);
    });

    test('fails closed with 503 when the lookup throws', async () => {
        blockedEmailRepository.findActiveByEmail.mockRejectedValue(new Error('db down'));
        const res = await emailBlockService.checkEmail('a@b.io');
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(503);
    });
});

describe('emailBlockService.applyBlock', () => {
    beforeEach(() => jest.clearAllMocks());

    test('creates the block with the email as given and revokes sessions in the same transaction', async () => {
        const transaction = { id: 'tx' };
        blockedEmailRepository.createIfNotActive.mockResolvedValue({ id: 9 });

        const block = await emailBlockService.applyBlock({
            email: 'Founder@Acme.io', companyId: 'c1', userIds: ['u1'], reason: 'KYC_REJECTED_MAX',
            blockedBy: 'admin-1', rejectionCount: 3, rejectionLimit: 3
        }, { transaction });

        expect(block).toEqual({ id: 9 });
        expect(blockedEmailRepository.createIfNotActive).toHaveBeenCalledWith(
            expect.objectContaining({
                email: 'Founder@Acme.io', company_id: 'c1', user_id: 'u1',
                rejection_count: 3, rejection_limit: 3, blocked_by: 'admin-1'
            }),
            { transaction }
        );
        expect(userSessionRepository.revokeAllSessionsByUser).toHaveBeenCalledWith('u1', { transaction });
    });

    test('does not try to revoke sessions when there is no user id', async () => {
        blockedEmailRepository.createIfNotActive.mockResolvedValue({ id: 1 });
        await emailBlockService.applyBlock({ email: 'a@b.io', userIds: [] }, { transaction: {} });
        expect(userSessionRepository.revokeAllSessionsByUser).not.toHaveBeenCalled();
    });

    test('revokes the sessions of every company user, not just the first', async () => {
        blockedEmailRepository.createIfNotActive.mockResolvedValue({ id: 9 });
        await emailBlockService.applyBlock({ email: 'a@b.io', userIds: ['u1', 'u2'] }, { transaction: {} });
        expect(userSessionRepository.revokeAllSessionsByUser).toHaveBeenCalledTimes(2);
        expect(userSessionRepository.revokeAllSessionsByUser).toHaveBeenCalledWith('u2', { transaction: {} });
    });

    test('invalidateSessionCache drops the cached jti set', async () => {
        await emailBlockService.invalidateSessionCache(['u1']);
        expect(sessionCacheRepository.invalidateUser).toHaveBeenCalledWith('u1');
        await emailBlockService.invalidateSessionCache(['u1', 'u2']);
        expect(sessionCacheRepository.invalidateUser).toHaveBeenCalledWith('u2');
    });
});

describe('emailBlockService.buildKycRejectionWarning', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        adminConfigService.getTrialConfigValue.mockResolvedValue(3);
    });

    test('returns null when there has been no rejection', async () => {
        expect(await emailBlockService.buildKycRejectionWarning({ kyc_rejection_count: 0, kyc_status: KYC_STATUS.PENDING })).toBeNull();
    });

    test('returns null instead of throwing when the limit lookup fails', async () => {
        adminConfigService.getTrialConfigValue.mockRejectedValue(new Error('redis down'));
        expect(await emailBlockService.buildKycRejectionWarning({ kyc_rejection_count: 1, kyc_status: KYC_STATUS.REJECTED })).toBeNull();
    });

    test('returns null once KYC is approved, even though the counter keeps its value', async () => {
        expect(await emailBlockService.buildKycRejectionWarning({ kyc_rejection_count: 2, kyc_status: KYC_STATUS.APPROVED })).toBeNull();
    });

    test('warns with the reason while Rejected', async () => {
        const w = await emailBlockService.buildKycRejectionWarning({
            kyc_rejection_count: 1, kyc_status: KYC_STATUS.REJECTED, kyc_rejection_reason: 'blurry'
        });
        expect(w).toMatchObject({
            kycStatus: 'Rejected', kycRejectionCount: 1, maxRejections: 3, attemptsRemaining: 2, kycRejectionReason: 'blurry'
        });
    });

    test('keeps warning after resubmission (Pending) — the trigger is the counter, not kyc_status', async () => {
        const w = await emailBlockService.buildKycRejectionWarning({
            kyc_rejection_count: 2, kyc_status: KYC_STATUS.PENDING, kyc_rejection_reason: null
        });
        expect(w).toMatchObject({ kycStatus: 'Pending', attemptsRemaining: 1, kycRejectionReason: null });
        expect(w.message).toMatch(/1 attempt remaining/);
    });
});
