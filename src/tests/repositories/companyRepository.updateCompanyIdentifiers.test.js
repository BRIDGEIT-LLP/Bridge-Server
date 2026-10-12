'use strict';

jest.mock('../../models', () => ({
    Company: { update: jest.fn() },
    CompanyUserRole: {},
    CompanyRoleMaster: {},
    User: {},
    sequelize: { query: jest.fn() }
}));

const { Company } = require('../../models');
const companyRepository = require('../../repositories/companyRepository');

describe('companyRepository.updateCompanyIdentifiers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Company.update.mockResolvedValue([1, [{ id: 'company-1', gst_number: '22AAAAA0000A1Z5' }]]);
    });

    test('writes only GST/CIN columns and ignores unrelated payload keys', async () => {
        await companyRepository.updateCompanyIdentifiers('company-1', {
            gst_number: '22AAAAA0000A1Z5',
            is_gst_verified: true,
            cin_number: 'U12345MH2024PTC123456',
            is_cin_verified: true,
            company_name: 'Hacked',
            password: 'nope'
        });

        const written = Company.update.mock.calls[0][0];
        expect(written.gst_number).toBe('22AAAAA0000A1Z5');
        expect(written.is_gst_verified).toBe(true);
        expect(written.cin_number).toBe('U12345MH2024PTC123456');
        expect(written.is_cin_verified).toBe(true);
        expect(written).not.toHaveProperty('company_name');
        expect(written).not.toHaveProperty('password');
        expect(written).toHaveProperty('updated_at');
    });

    test('returns null when there is nothing to write', async () => {
        const result = await companyRepository.updateCompanyIdentifiers('company-1', {
            company_name: 'Ignored'
        });

        expect(result).toBeNull();
        expect(Company.update).not.toHaveBeenCalled();
    });
});
