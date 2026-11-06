'use strict';

jest.mock('../../models', () => ({ sequelize: { transaction: jest.fn() } }));
jest.mock('../../repositories/companyRepository', () => ({
    getCompanyById: jest.fn(),
    updateKycStatus: jest.fn(),
    markKycUploaded: jest.fn()
}));
jest.mock('../../repositories/kycInfoRepository', () => ({
    findKycRecord: jest.fn(),
    findAllKycRecords: jest.fn(),
    findAllKycRecordsRaw: jest.fn(),
    createKycRecord: jest.fn(),
    updateKycRecord: jest.fn()
}));
jest.mock('../../repositories/userRepository', () => ({ updateUser: jest.fn() }));
jest.mock('../../repositories/userLimitConfigRepository', () => ({}));
jest.mock('../../services/adminConfigService', () => ({}));
jest.mock('../../services/emailBlockService', () => ({ checkEmail: jest.fn() }));
jest.mock('../../configs/logger', () => ({ errorLogger: { error: jest.fn() } }));
jest.mock('../../utils/encryption', () => ({
    encrypt: jest.fn((v) => ({ encryptedData: `enc(${v})`, iv: 'iv', authTag: 'tag' })),
    decrypt: jest.fn((v) => v.replace(/^enc\(|\)$/g, ''))
}));

const { sequelize } = require('../../models');
const companyRepository = require('../../repositories/companyRepository');
const kycInfoRepository = require('../../repositories/kycInfoRepository');
const emailBlockService = require('../../services/emailBlockService');
const { buildKycRecords, createKycInfo, getKycRequirements } = require('../../services/kycService');

const ids = { userId: 'u1', companyId: 'c1', roleId: 2 };
const file = (name) => ({ s3_key: `k/${name}`, mimetype: 'application/pdf', file_name: name, file_size: 10 });
const PAN = 'ABCDE1234F';

describe('kycService.buildKycRecords', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        companyRepository.getCompanyById.mockResolvedValue({
            gst_number: '24AABCS1429B1Z5', cin_number: 'U25209GJ2008PTC053311'
        });
        kycInfoRepository.findKycRecord.mockResolvedValue(null);
    });

    test('rejects an empty body', async () => {
        const res = await buildKycRecords({ ...ids, roleCode: 'STARTUP', payload: {} });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(400);
    });

    test('rejects a document type the role does not use', async () => {
        const res = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR', payload: { PITCH_DECK: { front: file('deck.pdf') } }
        });
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/PITCH_DECK/);
    });

    test('founder: Aadhaar, PAN, incorporation certificate and pitch deck become rows', async () => {
        const res = await buildKycRecords({
            ...ids,
            roleCode: 'STARTUP',
            payload: {
                AADHAAR: { number: '123456789012', front: file('a1'), back: file('a2') },
                PAN: { number: PAN, front: file('pan') },
                INCORPORATION_CERTIFICATE: { front: file('inc.pdf') },
                PITCH_DECK: { front: file('deck.pdf') }
            }
        });
        expect(res.success).toBe(true);
        const byType = Object.fromEntries(res.data.map((r) => [r.document_type, r]));
        expect(byType.AADHAAR.back_s3_key).toBe('k/a2');
        expect(byType.PAN.document_number).toBe(`enc(${PAN})`);
        // company-owned number comes from the company record, not from the client
        expect(byType.INCORPORATION_CERTIFICATE.document_number).toBe('enc(U25209GJ2008PTC053311)');
        expect(byType.PITCH_DECK.document_number).toBeNull();
    });

    test('business owner: GST certificate carries the company GSTIN', async () => {
        const res = await buildKycRecords({
            ...ids,
            roleCode: 'B2B',
            payload: { GST_CERTIFICATE: { number: 'IGNORED', front: file('gst.pdf') } }
        });
        expect(res.success).toBe(true);
        expect(res.data[0].document_number).toBe('enc(24AABCS1429B1Z5)');
    });

    test('Aadhaar needs a 12-digit number and a back file', async () => {
        const noBack = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR',
            payload: { AADHAAR: { number: '123456789012', front: file('a1') } }
        });
        expect(noBack.message).toMatch(/back/);
        const badNumber = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR',
            payload: { AADHAAR: { number: '1234', front: file('a1'), back: file('a2') } }
        });
        expect(badNumber.message).toMatch(/not valid/);
    });

    test('PAN number defaults to the one saved on the Business step', async () => {
        kycInfoRepository.findKycRecord.mockResolvedValue({
            document_number: `enc(${PAN})`, document_number_iv: 'iv', document_number_auth_tag: 'tag'
        });
        const res = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR', payload: { PAN: { front: file('pan') } }
        });
        expect(res.success).toBe(true);
        expect(res.data[0].document_number).toBe(`enc(${PAN})`);
    });

    test('PAN number that differs from the Business step is refused', async () => {
        kycInfoRepository.findKycRecord.mockResolvedValue({
            document_number: `enc(${PAN})`, document_number_iv: 'iv', document_number_auth_tag: 'tag'
        });
        const res = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR', payload: { PAN: { number: 'ZZZZZ9999Z', front: file('pan') } }
        });
        expect(res.success).toBe(false);
        expect(res.message).toMatch(/does not match/);
    });
});

describe('kycService.createKycInfo required documents', () => {
    const tx = { commit: jest.fn(), rollback: jest.fn() };
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(tx);
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: false } });
        companyRepository.getCompanyById.mockResolvedValue({ is_kyc_uploaded: false, company_email: 'a@b.c' });
        kycInfoRepository.findKycRecord.mockResolvedValue(null);
        kycInfoRepository.createKycRecord.mockImplementation(async (r) => r);
    });

    const record = { user_id: 'u1', company_id: 'c1', role_id: 2, document_type: 'PAN', front_s3_key: 'k/pan' };

    test('marks KYC uploaded only when every document of the role has a file', async () => {
        kycInfoRepository.findAllKycRecords.mockResolvedValue([
            { document_type: 'PAN', front_s3_key: 'k/pan' },
            { document_type: 'AADHAAR', front_s3_key: 'k/a' },
            { document_type: 'INCORPORATION_CERTIFICATE', front_s3_key: 'k/i' }
        ]);
        await createKycInfo([record], { roleCode: 'STARTUP' });
        expect(companyRepository.markKycUploaded).not.toHaveBeenCalled();

        kycInfoRepository.findAllKycRecords.mockResolvedValue([
            { document_type: 'PAN', front_s3_key: 'k/pan' },
            { document_type: 'AADHAAR', front_s3_key: 'k/a' },
            { document_type: 'INCORPORATION_CERTIFICATE', front_s3_key: 'k/i' },
            { document_type: 'PITCH_DECK', front_s3_key: 'k/d' }
        ]);
        await createKycInfo([record], { roleCode: 'STARTUP' });
        expect(companyRepository.markKycUploaded).toHaveBeenCalledTimes(1);
    });

    test('a PAN row without a file (Business step) does not count as uploaded', async () => {
        kycInfoRepository.findAllKycRecords.mockResolvedValue([
            { document_type: 'PAN', front_s3_key: null },
            { document_type: 'AADHAAR', front_s3_key: 'k/a' }
        ]);
        await createKycInfo([record], { roleCode: 'INVESTOR' });
        expect(companyRepository.markKycUploaded).not.toHaveBeenCalled();
    });
});

describe('kycService.getKycRequirements', () => {
    const ids = { userId: 'u1', companyId: 'c1', roleId: 2 };
    beforeEach(() => {
        jest.clearAllMocks();
        companyRepository.getCompanyById.mockResolvedValue({
            gst_number: '24AABCS1429B1Z5', cin_number: 'U25209GJ2008PTC053311', kyc_status: 'pending', is_kyc_uploaded: false
        });
        kycInfoRepository.findAllKycRecordsRaw.mockResolvedValue([]);
    });

    test('founder gets PAN, Aadhaar, incorporation certificate and pitch deck in that order', async () => {
        const res = await getKycRequirements({ ...ids, roleCode: 'STARTUP' });
        expect(res.success).toBe(true);
        expect(res.data.documents.map(d => d.document_type)).toEqual(['PAN', 'AADHAAR', 'INCORPORATION_CERTIFICATE', 'PITCH_DECK']);
        const aadhaar = res.data.documents[1];
        expect(aadhaar.sides).toEqual(['front', 'back']);
        expect(res.data.documents[3].accepted_mime_types).toEqual(['application/pdf']);
    });

    test('business owner gets company numbers and the company PAN wording', async () => {
        const res = await getKycRequirements({ ...ids, roleCode: 'B2B' });
        const byType = Object.fromEntries(res.data.documents.map(d => [d.document_type, d]));
        expect(Object.keys(byType)).toEqual(['GST_CERTIFICATE', 'INCORPORATION_CERTIFICATE', 'PAN']);
        expect(byType.GST_CERTIFICATE.number).toBe('24AABCS1429B1Z5');
        expect(byType.INCORPORATION_CERTIFICATE.number).toBe('U25209GJ2008PTC053311');
        expect(byType.PAN.label).toBe('Company PAN card');
    });

    test('returns the PAN saved on the Business step and what is already uploaded', async () => {
        kycInfoRepository.findAllKycRecordsRaw.mockResolvedValue([{
            document_type: 'PAN', document_number: 'enc(ABCDE1234F)', document_number_iv: 'iv', document_number_auth_tag: 'tag',
            front_s3_key: 'k/pan', front_file_name: 'pan.jpg', front_file_size: 100, front_mime_type: 'image/jpeg', status: 'rejected',
            rejection_reason: 'blurred'
        }]);
        const res = await getKycRequirements({ ...ids, roleCode: 'INVESTOR' });
        const pan = res.data.documents.find(d => d.document_type === 'PAN');
        expect(pan.number).toBe('ABCDE1234F');
        expect(pan.uploaded).toBe(true);
        expect(pan.files.front.file_name).toBe('pan.jpg');
        expect(pan.rejection_reason).toBe('blurred');
        expect(res.data.documents.find(d => d.document_type === 'AADHAAR').uploaded).toBe(false);
    });

    test('unknown role is refused', async () => {
        const res = await getKycRequirements({ ...ids, roleCode: 'ADMIN' });
        expect(res.success).toBe(false);
        expect(res.statusCode).toBe(403);
    });
});

describe('kycService draft mode', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        companyRepository.getCompanyById.mockResolvedValue({ gst_number: null, cin_number: null, is_kyc_uploaded: false });
        kycInfoRepository.findKycRecord.mockResolvedValue(null);
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: false } });
        sequelize.transaction.mockResolvedValue({ commit: jest.fn(), rollback: jest.fn() });
    });

    test('an empty draft is accepted and has nothing to save', async () => {
        const res = await buildKycRecords({ ...ids, roleCode: 'INVESTOR', payload: {}, draft: true });
        expect(res.success).toBe(true);
        expect(res.data).toEqual([]);
    });

    test('a draft keeps a lone PAN file without the Aadhaar and needs no number', async () => {
        const res = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR', draft: true,
            payload: { PAN: { front: file('pan.jpg') }, AADHAAR: {} }
        });
        expect(res.success).toBe(true);
        expect(res.data).toHaveLength(1);
        expect(res.data[0]).toMatchObject({ document_type: 'PAN', front_s3_key: 'k/pan.jpg' });
        expect(res.data[0]).not.toHaveProperty('document_number');
    });

    test('a draft number that is sent must still be well formed', async () => {
        const res = await buildKycRecords({
            ...ids, roleCode: 'INVESTOR', draft: true, payload: { AADHAAR: { number: '123' } }
        });
        expect(res.success).toBe(false);
    });

    test('a draft never marks the KYC as uploaded or clears a rejection', async () => {
        companyRepository.getCompanyById.mockResolvedValue({ kyc_status: 'Rejected', is_kyc_uploaded: false, company_email: 'a@b.c' });
        kycInfoRepository.createKycRecord.mockResolvedValue({ front_s3_key: 'k/pan.jpg' });
        const res = await createKycInfo(
            [{ ...ids, user_id: 'u1', company_id: 'c1', role_id: 2, document_type: 'PAN', front_s3_key: 'k/pan.jpg' }],
            { roleCode: 'INVESTOR', draft: true }
        );
        expect(res.success).toBe(true);
        expect(companyRepository.markKycUploaded).not.toHaveBeenCalled();
        expect(companyRepository.updateKycStatus).not.toHaveBeenCalled();
    });
});
