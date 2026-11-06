'use strict';

const mockTx = { commit: jest.fn(), rollback: jest.fn() };
jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn(() => Promise.resolve(mockTx)) }
}));
jest.mock('../../repositories/companyRepository', () => ({
    getCompanyById: jest.fn(),
    updateCompanyIdentifiers: jest.fn(),
    setDraftStep: jest.fn()
}));
jest.mock('../../repositories/kycInfoRepository', () => ({
    findKycRecord: jest.fn(),
    createKycRecord: jest.fn(),
    updateKycRecord: jest.fn()
}));
jest.mock('../../services/cinVerificationService', () => ({ verifyCin: jest.fn() }));
jest.mock('../../services/gstVerificationService', () => ({ verifyGst: jest.fn() }));
jest.mock('../../configs/logger', () => ({ errorLogger: { error: jest.fn() } }));
jest.mock('../../utils/encryption', () => ({
    encrypt: jest.fn(() => ({ encryptedData: 'enc', iv: 'iv', authTag: 'tag' }))
}));

const companyRepository = require('../../repositories/companyRepository');
const kycInfoRepository = require('../../repositories/kycInfoRepository');
const cinVerificationService = require('../../services/cinVerificationService');
const gstVerificationService = require('../../services/gstVerificationService');
const { saveBusinessCheck } = require('../../services/businessCheckService');

const ids = { userId: 'u1', companyId: 'c1', roleId: 2 };
const CIN = 'U72900MH2021PTC351234';
const PAN = 'ABCDE1234F';
const GSTIN = '24AABCS1429B1Z5';

describe('businessCheckService.saveBusinessCheck', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        companyRepository.getCompanyById.mockResolvedValue({ id: 'c1', cin_number: null, is_gst_verified: false, is_cin_verified: false });
        cinVerificationService.verifyCin.mockResolvedValue({ success: true, data: { verified: true } });
        gstVerificationService.verifyGst.mockResolvedValue({ success: true, data: { verified: true } });
        kycInfoRepository.findKycRecord.mockResolvedValue(null);
    });

    test('B2B requires both GSTIN and CIN', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'B2B', body: { cin_number: CIN } });
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/gst_number is required/);
    });

    test('B2B verifies and stores GSTIN and CIN on the company, no PAN row', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'B2B', body: { gst_number: GSTIN, cin_number: CIN } });
        expect(res.success).toBe(true);
        expect(gstVerificationService.verifyGst).toHaveBeenCalledWith(GSTIN);
        expect(cinVerificationService.verifyCin).toHaveBeenCalledWith(CIN);
        expect(companyRepository.updateCompanyIdentifiers).toHaveBeenCalledWith(
            'c1', { gst_number: GSTIN, is_gst_verified: true, cin_number: CIN, is_cin_verified: true }, { transaction: mockTx }
        );
        expect(kycInfoRepository.createKycRecord).not.toHaveBeenCalled();
    });

    test('B2B cannot change a GSTIN that is already saved', async () => {
        companyRepository.getCompanyById.mockResolvedValue({ id: 'c1', gst_number: GSTIN, is_gst_verified: true });
        const res = await saveBusinessCheck({ ...ids, role: 'B2B', body: { gst_number: '27AAAAA0000A1Z5', cin_number: CIN } });
        expect(res.success).toBe(false);
        expect(gstVerificationService.verifyGst).not.toHaveBeenCalled();
    });

    test('a GSTIN sent by a founder is ignored', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { gst_number: GSTIN, cin_number: CIN, pan_number: PAN } });
        expect(res.success).toBe(true);
        expect(gstVerificationService.verifyGst).not.toHaveBeenCalled();
    });

    test('STARTUP requires both CIN and PAN', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: CIN } });
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/pan_number is required/);
    });

    test('STARTUP verifies and stores CIN on company and PAN encrypted in kyc_info', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: CIN, pan_number: PAN } });
        expect(res.success).toBe(true);
        expect(cinVerificationService.verifyCin).toHaveBeenCalledWith(CIN);
        expect(companyRepository.updateCompanyIdentifiers).toHaveBeenCalledWith(
            'c1', { cin_number: CIN, is_cin_verified: true }, { transaction: mockTx }
        );
        expect(kycInfoRepository.createKycRecord).toHaveBeenCalledWith(
            expect.objectContaining({ document_type: 'PAN', document_number: 'enc', document_number_iv: 'iv', document_number_auth_tag: 'tag' }),
            { transaction: mockTx }
        );
        expect(mockTx.commit).toHaveBeenCalled();
    });

    test('INVESTOR needs only PAN; CIN is optional', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'INVESTOR', body: { pan_number: PAN } });
        expect(res.success).toBe(true);
        expect(cinVerificationService.verifyCin).not.toHaveBeenCalled();
        expect(companyRepository.updateCompanyIdentifiers).not.toHaveBeenCalled();
    });

    test('a failed CIN verification stores nothing', async () => {
        cinVerificationService.verifyCin.mockResolvedValue({ success: false, message: 'nope', statusCode: 400 });
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: CIN, pan_number: PAN } });
        expect(res.success).toBe(false);
        expect(kycInfoRepository.createKycRecord).not.toHaveBeenCalled();
    });

    test('CIN already on file: same value is a no-op, a different one is refused', async () => {
        companyRepository.getCompanyById.mockResolvedValue({ cin_number: CIN, is_cin_verified: true });
        const same = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: CIN, pan_number: PAN } });
        expect(same.success).toBe(true);
        expect(cinVerificationService.verifyCin).not.toHaveBeenCalled();

        const other = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: 'L72900MH2021PTC351234', pan_number: PAN } });
        expect(other.success).toBe(false);
    });

    test('an existing PAN row is updated in place; an approved one is locked', async () => {
        kycInfoRepository.findKycRecord.mockResolvedValue({ id: 9, status: 'Pending' });
        await saveBusinessCheck({ ...ids, role: 'INVESTOR', body: { pan_number: PAN } });
        expect(kycInfoRepository.updateKycRecord).toHaveBeenCalledWith(9, expect.objectContaining({ document_number: 'enc' }), { transaction: mockTx });

        kycInfoRepository.findKycRecord.mockResolvedValue({ id: 9, status: 'Approved' });
        const locked = await saveBusinessCheck({ ...ids, role: 'INVESTOR', body: { pan_number: PAN } });
        expect(locked.success).toBe(false);
        expect(mockTx.rollback).toHaveBeenCalled();
    });

    test('a normal Continue clears the draft marker', async () => {
        await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { cin_number: CIN, pan_number: PAN } });
        expect(companyRepository.setDraftStep).toHaveBeenCalledWith('u1', 'c1', 2, null, { transaction: mockTx });
    });

    test('a draft with nothing filled in is accepted and remembers the step', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: {}, draft: true, step: 'business' });
        expect(res.success).toBe(true);
        expect(companyRepository.updateCompanyIdentifiers).not.toHaveBeenCalled();
        expect(companyRepository.setDraftStep).toHaveBeenCalledWith('u1', 'c1', 2, 'business', { transaction: mockTx });
    });

    test('a draft saves the PAN that is there without the CIN', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { pan_number: PAN }, draft: true, step: 'business' });
        expect(res.success).toBe(true);
        expect(kycInfoRepository.createKycRecord).toHaveBeenCalledWith(
            expect.objectContaining({ document_type: 'PAN', document_number: 'enc' }),
            { transaction: mockTx }
        );
        expect(companyRepository.updateCompanyIdentifiers).not.toHaveBeenCalled();
    });

    test('without draft the missing fields are still refused', async () => {
        const res = await saveBusinessCheck({ ...ids, role: 'STARTUP', body: { pan_number: PAN } });
        expect(res.success).toBe(false);
    });
});
