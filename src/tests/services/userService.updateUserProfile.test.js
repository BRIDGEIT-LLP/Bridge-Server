'use strict';

const mockTransaction = { commit: jest.fn(), rollback: jest.fn() };

jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../repositories/userRepository', () => ({
    updateUser: jest.fn()
}));

jest.mock('../../repositories/companyRepository', () => ({
    getCompanyById: jest.fn(),
    updateCompanyContact: jest.fn(),
    updateCompanyIdentifiers: jest.fn()
}));

jest.mock('../../services/gstVerificationService', () => ({
    verifyGst: jest.fn()
}));

jest.mock('../../services/cinVerificationService', () => ({
    verifyCin: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../utils/encryption', () => ({
    encrypt: jest.fn(),
    decrypt: jest.fn()
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const { sequelize } = require('../../models');
const userRepository = require('../../repositories/userRepository');
const companyRepository = require('../../repositories/companyRepository');
const gstVerificationService = require('../../services/gstVerificationService');
const cinVerificationService = require('../../services/cinVerificationService');
const userService = require('../../services/userService');
const { GST_MESSAGES, CIN_MESSAGES, USER_MESSAGES } = require('../../utils/constant');

const GSTIN = '22AAAAA0000A1Z5';
const CIN = 'U12345MH2024PTC123456';

describe('userService.updateUserProfile company identifiers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.transaction.mockResolvedValue(mockTransaction);
        userRepository.updateUser.mockResolvedValue({ id: 'user-1' });
        companyRepository.updateCompanyContact.mockResolvedValue(null);
        companyRepository.updateCompanyIdentifiers.mockResolvedValue({});
        companyRepository.getCompanyById.mockResolvedValue({
            id: 'company-1',
            gst_number: null,
            cin_number: null
        });
        gstVerificationService.verifyGst.mockResolvedValue({ success: true });
        cinVerificationService.verifyCin.mockResolvedValue({ success: true });
    });

    test('writes verified GST/CIN onto an empty company row', async () => {
        const result = await userService.updateUserProfile(
            { first_name: 'Ada', gst_number: GSTIN.toLowerCase(), cin_number: CIN.toLowerCase() },
            'user-1',
            'company-1'
        );

        expect(result.success).toBe(true);
        expect(gstVerificationService.verifyGst).toHaveBeenCalledWith(GSTIN);
        expect(cinVerificationService.verifyCin).toHaveBeenCalledWith(CIN);
        expect(companyRepository.updateCompanyIdentifiers).toHaveBeenCalledWith(
            'company-1',
            {
                gst_number: GSTIN,
                is_gst_verified: true,
                cin_number: CIN,
                is_cin_verified: true
            },
            { transaction: mockTransaction }
        );
        expect(mockTransaction.commit).toHaveBeenCalled();
    });

    test('skips identifier writes when the payload has no GST/CIN', async () => {
        const result = await userService.updateUserProfile(
            { first_name: 'Ada' },
            'user-1',
            'company-1'
        );

        expect(result.success).toBe(true);
        expect(companyRepository.getCompanyById).not.toHaveBeenCalled();
        expect(gstVerificationService.verifyGst).not.toHaveBeenCalled();
        expect(companyRepository.updateCompanyIdentifiers).not.toHaveBeenCalled();
        expect(userRepository.updateUser).toHaveBeenCalled();
    });

    test('refuses to overwrite a GST that is already saved', async () => {
        companyRepository.getCompanyById.mockResolvedValue({
            id: 'company-1',
            gst_number: GSTIN,
            cin_number: null
        });

        const result = await userService.updateUserProfile(
            { gst_number: '27AAAAA0000A1Z5' },
            'user-1',
            'company-1'
        );

        expect(result).toEqual(expect.objectContaining({
            success: false,
            statusCode: 400,
            message: GST_MESSAGES.ALREADY_SET
        }));
        expect(userRepository.updateUser).not.toHaveBeenCalled();
        expect(mockTransaction.commit).not.toHaveBeenCalled();
    });

    test('refuses to overwrite a CIN that is already saved', async () => {
        companyRepository.getCompanyById.mockResolvedValue({
            id: 'company-1',
            gst_number: null,
            cin_number: CIN
        });

        const result = await userService.updateUserProfile(
            { cin_number: 'L12345MH2024PLC123456' },
            'user-1',
            'company-1'
        );

        expect(result).toEqual(expect.objectContaining({
            success: false,
            statusCode: 400,
            message: CIN_MESSAGES.ALREADY_SET
        }));
        expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    test('returns 400 without writing when GST verification fails', async () => {
        gstVerificationService.verifyGst.mockResolvedValue({
            success: false,
            message: GST_MESSAGES.VERIFY_FAILED,
            statusCode: 400
        });

        const result = await userService.updateUserProfile(
            { gst_number: GSTIN },
            'user-1',
            'company-1'
        );

        expect(result).toEqual(expect.objectContaining({
            success: false,
            statusCode: 400,
            message: GST_MESSAGES.VERIFY_FAILED
        }));
        expect(companyRepository.updateCompanyIdentifiers).not.toHaveBeenCalled();
        expect(userRepository.updateUser).not.toHaveBeenCalled();
    });

    test('returns 400 for an invalid GSTIN format without calling verification', async () => {
        const result = await userService.updateUserProfile(
            { gst_number: 'not-a-gstin' },
            'user-1',
            'company-1'
        );

        expect(result).toEqual(expect.objectContaining({
            success: false,
            statusCode: 400,
            message: GST_MESSAGES.INVALID_FORMAT
        }));
        expect(gstVerificationService.verifyGst).not.toHaveBeenCalled();
    });

    test('rolls back when the user update throws', async () => {
        userRepository.updateUser.mockRejectedValue(new Error('db down'));

        const result = await userService.updateUserProfile(
            { first_name: 'Ada' },
            'user-1',
            'company-1'
        );

        expect(result).toEqual(expect.objectContaining({
            success: false,
            statusCode: 500,
            message: USER_MESSAGES.UPDATE_FAILED
        }));
        expect(mockTransaction.rollback).toHaveBeenCalled();
    });
});
