'use strict';

jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../repositories/userRepository', () => ({
    getUserKycDocs: jest.fn()
}));

jest.mock('../../repositories/companyRepository', () => ({}));
jest.mock('../../repositories/connectionRepository', () => ({}));
jest.mock('../../services/gstVerificationService', () => ({}));
jest.mock('../../services/cinVerificationService', () => ({}));
jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));
jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn()
}));
jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const userRepository = require('../../repositories/userRepository');
const userService = require('../../services/userService');

describe('userService.getUserKycDocs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('keeps company kyc_status separate from each document status', async () => {
        userRepository.getUserKycDocs.mockResolvedValue([
            {
                uid: 1,
                cid: 'company-1',
                first_name: 'Ada',
                last_name: 'Lovelace',
                profile_photo: null,
                company_email: 'ada@example.com',
                company_name: 'Analytical Engines',
                country_code: '+91',
                mobile_number: '9999999999',
                is_email_verified: true,
                is_mobile_number_verified: true,
                kyc_status: 'Pending',
                is_kyc_verified: false,
                kyc_rejection_reason: null,
                kyc_id: 11,
                document_type: 'AADHAAR',
                document_number: null,
                document_number_iv: null,
                document_number_auth_tag: null,
                front_s3_key: 'aadhaar-front',
                front_file_name: 'front.jpg',
                back_s3_key: null,
                back_file_name: null,
                document_status: 'Approved',
                rejection_reason: null,
                verified_at: '2026-09-01T00:00:00.000Z',
                kyc_uploaded_at: '2026-08-01T00:00:00.000Z'
            },
            {
                uid: 1,
                cid: 'company-1',
                kyc_status: 'Pending',
                is_kyc_verified: false,
                kyc_id: 12,
                document_type: 'PAN',
                document_number: null,
                document_number_iv: null,
                document_number_auth_tag: null,
                front_s3_key: 'pan-front',
                front_file_name: 'pan.jpg',
                back_s3_key: null,
                back_file_name: null,
                document_status: 'Rejected',
                rejection_reason: 'Unreadable',
                verified_at: '2026-09-02T00:00:00.000Z',
                kyc_uploaded_at: '2026-08-02T00:00:00.000Z'
            }
        ]);

        const result = await userService.getUserKycDocs();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(result.data[0]).toEqual(expect.objectContaining({
            kyc_status: 'Pending',
            is_kyc_verified: false,
            kyc_rejection_reason: null
        }));
        expect(result.data[0].kyc_documents).toEqual([
            expect.objectContaining({ document_type: 'AADHAAR', kyc_status: 'Approved' }),
            expect.objectContaining({ document_type: 'PAN', kyc_status: 'Rejected' })
        ]);
    });

    test('exposes company kyc_rejection_reason separately from document rejection_reason', async () => {
        userRepository.getUserKycDocs.mockResolvedValue([
            {
                uid: 2,
                cid: 'company-2',
                first_name: 'Grace',
                last_name: 'Hopper',
                profile_photo: null,
                company_email: 'grace@example.com',
                company_name: 'COBOL Corp',
                country_code: '+91',
                mobile_number: '8888888888',
                is_email_verified: true,
                is_mobile_number_verified: true,
                kyc_status: 'Rejected',
                is_kyc_verified: false,
                kyc_rejection_reason: 'PAN does not match company records',
                kyc_id: 21,
                document_type: 'PAN',
                document_number: null,
                document_number_iv: null,
                document_number_auth_tag: null,
                front_s3_key: 'pan-front',
                front_file_name: 'pan.jpg',
                back_s3_key: null,
                back_file_name: null,
                document_status: 'Rejected',
                rejection_reason: null,
                verified_at: '2026-09-02T00:00:00.000Z',
                kyc_uploaded_at: '2026-08-02T00:00:00.000Z'
            }
        ]);

        const result = await userService.getUserKycDocs();

        expect(result.success).toBe(true);
        expect(result.data[0]).toEqual(expect.objectContaining({
            kyc_status: 'Rejected',
            kyc_rejection_reason: 'PAN does not match company records'
        }));
        expect(result.data[0].kyc_documents[0]).toEqual(expect.objectContaining({
            rejection_reason: null
        }));
    });
});
