'use strict';

jest.mock('../../models', () => ({
    KycInfo: {},
    sequelize: { query: jest.fn() }
}));

const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const kycInfoRepository = require('../../repositories/kycInfoRepository');
const { KYC_DOC_TYPES } = require('../../utils/constant');

describe('kycInfoRepository.findAllKycRecordsRaw', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.query.mockResolvedValue([]);
    });

    test('returns only the latest PAN and Aadhaar document for the user', async () => {
        await kycInfoRepository.findAllKycRecordsRaw({
            userId: 'user-1',
            companyId: 'company-1',
            roleId: 3
        });

        expect(sequelize.query).toHaveBeenCalledTimes(1);
        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('SELECT DISTINCT ON (document_type)');
        expect(sql).toContain('document_type IN (:kycDocTypes)');
        expect(sql).toContain('ORDER BY document_type, created_at DESC, id DESC');
        expect(options).toEqual(expect.objectContaining({
            type: QueryTypes.SELECT,
            replacements: {
                userId: 'user-1',
                companyId: 'company-1',
                roleId: 3,
                kycDocTypes: KYC_DOC_TYPES
            }
        }));
    });
});
