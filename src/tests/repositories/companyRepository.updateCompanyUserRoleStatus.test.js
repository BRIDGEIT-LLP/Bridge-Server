'use strict';

jest.mock('../../models', () => ({
    Company: {},
    CompanyUserRole: { update: jest.fn() },
    CompanyRoleMaster: {},
    User: {},
    sequelize: { query: jest.fn() }
}));

const { CompanyUserRole } = require('../../models');
const companyRepository = require('../../repositories/companyRepository');

describe('companyRepository.updateCompanyUserRoleStatus', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    /*
     * An admin (or a buggy client) passing the company_user_role_id of a
     * user's original default role must never be able to update it through
     * the switch-role review endpoint — that role isn't a pending switch
     * request and rejecting it would lock the user out of their account.
     */
    test('scopes the update to non-default roles only', async () => {
        CompanyUserRole.update.mockResolvedValue([1, [{ id: 1, status: 'Approved' }]]);

        await companyRepository.updateCompanyUserRoleStatus(1, { status: 'Approved' });

        expect(CompanyUserRole.update).toHaveBeenCalledWith(
            expect.objectContaining({ status: 'Approved' }),
            expect.objectContaining({
                where: { id: 1, is_deleted: false, is_default_role: false }
            })
        );
    });

    test('returns null (not the default role) when no matching non-default row exists', async () => {
        CompanyUserRole.update.mockResolvedValue([0, []]);

        const result = await companyRepository.updateCompanyUserRoleStatus(1, { status: 'Approved' });

        expect(result).toBeNull();
    });
});
