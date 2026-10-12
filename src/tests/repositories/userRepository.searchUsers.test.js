'use strict';

jest.mock('../../models', () => ({
    User: {},
    UserProfileFieldMaster: { findAll: jest.fn() },
    sequelize: { query: jest.fn() }
}));

const { sequelize } = require('../../models');
const { QueryTypes } = require('sequelize');
const userRepository = require('../../repositories/userRepository');
const { CONNECTION_BLOCKING_STATUSES, KYC_STATUS, KYC_DOC_TYPES } = require('../../utils/constant');

describe('userRepository.searchUsers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        sequelize.query.mockResolvedValue([]);
    });

    test('joins the viewer\'s blocking connection onto each result', async () => {
        await userRepository.searchUsers('ada', ['STARTUP'], 'viewer-1', 'viewer-1', 3);

        expect(sequelize.query).toHaveBeenCalledTimes(1);
        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('conn.status AS connection_status');
        expect(sql).toContain('crm.role_code AS role');
        expect(sql).toContain('crm.role_name');
        expect(sql).toContain('LEFT JOIN LATERAL');
        expect(sql).toContain('FROM user_connection uc');
        expect(options).toEqual(expect.objectContaining({
            type: QueryTypes.SELECT,
            replacements: expect.objectContaining({
                viewerUserId: 'viewer-1',
                viewerRoleId: 3,
                excludeUserId: 'viewer-1',
                blockingStatuses: CONNECTION_BLOCKING_STATUSES,
                searchableRoles: ['STARTUP'],
                approvedStatus: KYC_STATUS.APPROVED,
                kycDocTypes: KYC_DOC_TYPES,
                kycDocTypeCount: KYC_DOC_TYPES.length
            })
        }));
    });

    test('omits the connection join when the viewer role is missing', async () => {
        await userRepository.searchUsers('ada', [], 'viewer-1');

        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('NULL AS connection_status');
        expect(sql).not.toContain('LEFT JOIN LATERAL');
        expect(options.replacements.viewerUserId).toBeUndefined();
    });

    test('restricts results to completed profiles with approved company KYC and documents', async () => {
        await userRepository.searchUsers('ada', ['STARTUP'], 'viewer-1');

        const [sql, options] = sequelize.query.mock.calls[0];
        expect(sql).toContain('cur.is_profile_completed IS TRUE');
        expect(sql).toContain('c.is_kyc_verified IS TRUE');
        expect(sql).toContain('c.kyc_status = :approvedStatus');
        expect(sql).toContain('FROM kyc_info k');
        expect(sql).toContain('k.document_type IN (:kycDocTypes)');
        expect(options.replacements).toEqual(expect.objectContaining({
            approvedStatus: KYC_STATUS.APPROVED,
            kycDocTypes: KYC_DOC_TYPES,
            kycDocTypeCount: KYC_DOC_TYPES.length
        }));
    });
});
