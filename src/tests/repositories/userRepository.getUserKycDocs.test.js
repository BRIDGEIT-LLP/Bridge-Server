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

describe('userRepository.getUserKycDocs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.query.mockResolvedValue([]);
    });

    test('joins only the latest PAN and Aadhaar document per user', async () => {
        await userRepository.getUserKycDocs();

        expect(sequelize.query).toHaveBeenCalledTimes(1);
        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('LEFT JOIN LATERAL');
        expect(sql).toContain('SELECT DISTINCT ON (k.document_type)');
        expect(sql).toContain('k.document_type IN (:kycDocTypes)');
        expect(sql).toContain('c.kyc_status');
        expect(sql).toContain('c.is_kyc_verified');
        expect(sql).toContain('c.kyc_rejection_reason');
        expect(sql).toContain('k.status AS document_status');
        expect(sql).not.toContain('k.status AS kyc_status');
        expect(sql).toContain('ORDER BY k.document_type, k.created_at DESC, k.id DESC');
        expect(options).toEqual(expect.objectContaining({
            type: QueryTypes.SELECT,
            replacements: { kycDocTypes: KYC_DOC_TYPES }
        }));
    });
});
