'use strict';

jest.mock('../../models', () => ({
    Company: {},
    CompanyUserRole: { findOne: jest.fn() },
    CompanyRoleMaster: {},
    User: {},
    sequelize: { query: jest.fn() }
}));

const { CompanyUserRole } = require('../../models');
const companyRepository = require('../../repositories/companyRepository');

describe('companyRepository.findCompanyUserRoleById', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('scopes the lookup to non-default, non-deleted roles', async () => {
        CompanyUserRole.findOne.mockResolvedValue({ id: 1, is_profile_completed: true });

        await companyRepository.findCompanyUserRoleById(1);

        expect(CompanyUserRole.findOne).toHaveBeenCalledWith({
            where: { id: 1, is_deleted: false, is_default_role: false }
        });
    });

    test('returns null when no matching switch-role row exists', async () => {
        CompanyUserRole.findOne.mockResolvedValue(null);

        const result = await companyRepository.findCompanyUserRoleById(99);

        expect(result).toBeNull();
    });
});
