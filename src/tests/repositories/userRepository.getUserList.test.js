'use strict';

jest.mock('../../models', () => ({
    User: {},
    UserProfileFieldMaster: { findAll: jest.fn() },
    sequelize: { query: jest.fn() }
}));

const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const userRepository = require('../../repositories/userRepository');
const { KYC_DOC_TYPES } = require('../../utils/constant');

describe('userRepository.getUserList', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.query.mockResolvedValue([]);
    });

    test('includes company kyc_status and a document-existence flag, not per-document status', async () => {
        await userRepository.getUserList();

        expect(sequelize.query).toHaveBeenCalledTimes(1);
        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('c.kyc_status');
        expect(sql).toContain('EXISTS (');
        expect(sql).toContain('FROM kyc_info k');
        expect(sql).toContain('k.document_type IN (:kycDocTypes)');
        expect(sql).toContain('AS has_kyc_documents');
        expect(sql).not.toContain('k.status');
        expect(options).toEqual(expect.objectContaining({
            type: QueryTypes.SELECT,
            replacements: { kycDocTypes: KYC_DOC_TYPES }
        }));
    });
});
