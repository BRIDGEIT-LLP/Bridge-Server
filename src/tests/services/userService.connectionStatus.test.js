'use strict';

jest.mock('../../models', () => ({
    sequelize: { transaction: jest.fn() }
}));

jest.mock('../../repositories/userRepository', () => ({
    searchUsers: jest.fn(),
    getUserById: jest.fn(),
    getUserProfileFieldsConfig: jest.fn()
}));

jest.mock('../../repositories/companyRepository', () => ({
    getCompanyById: jest.fn()
}));

jest.mock('../../repositories/connectionRepository', () => ({
    findExistingConnection: jest.fn()
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

const userRepository = require('../../repositories/userRepository');
const companyRepository = require('../../repositories/companyRepository');
const connectionRepository = require('../../repositories/connectionRepository');
const userService = require('../../services/userService');
const { USER_ROLES_CODE, CONNECTION_STATUS } = require('../../utils/constant');

describe('userService.searchUsers connection status', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('passes the viewer ids so search can attach connection_status', async () => {
        userRepository.searchUsers.mockResolvedValue([
            { user_id: 'target-1', connection_status: CONNECTION_STATUS.ACCEPTED }
        ]);

        const result = await userService.searchUsers('ada', USER_ROLES_CODE.STARTUP, 'viewer-1', 3);

        expect(result.success).toBe(true);
        expect(userRepository.searchUsers).toHaveBeenCalledWith(
            'ada',
            [USER_ROLES_CODE.INVESTOR, USER_ROLES_CODE.B2B],
            'viewer-1',
            'viewer-1',
            3
        );
        expect(result.data[0].connection_status).toBe(CONNECTION_STATUS.ACCEPTED);
    });
});

describe('userService.getViewedUserProfile', () => {
    const fieldsConfig = [
        {
            field_name: 'first_name',
            source_table: 'user',
            display_name: 'First name',
            is_editable: false,
            type: 'string'
        }
    ];

    beforeEach(() => {
        jest.clearAllMocks();
        userRepository.getUserById.mockResolvedValue({ id: 'target-1', first_name: 'Ada' });
        companyRepository.getCompanyById.mockResolvedValue({ id: 'company-1' });
        userRepository.getUserProfileFieldsConfig.mockResolvedValue(fieldsConfig);
        connectionRepository.findExistingConnection.mockResolvedValue(null);
    });

    test('includes null connection_status when no blocking connection exists', async () => {
        const result = await userService.getViewedUserProfile({
            companyId: 'company-1',
            userId: 'target-1',
            roleId: 2,
            viewerUserId: 'viewer-1',
            viewerRoleId: 3
        });

        expect(result.success).toBe(true);
        expect(result.data.connection_status).toBeNull();
        expect(result.data.fields).toEqual([
            expect.objectContaining({ columnName: 'first_name', value: 'Ada' })
        ]);
        expect(connectionRepository.findExistingConnection).toHaveBeenCalledWith(
            'viewer-1',
            3,
            'target-1',
            2
        );
    });

    test('returns the blocking connection status so Connect can be disabled', async () => {
        connectionRepository.findExistingConnection.mockResolvedValue({
            id: 9,
            status: CONNECTION_STATUS.PENDING
        });

        const result = await userService.getViewedUserProfile({
            companyId: 'company-1',
            userId: 'target-1',
            roleId: 2,
            viewerUserId: 'viewer-1',
            viewerRoleId: 3
        });

        expect(result.success).toBe(true);
        expect(result.data.connection_status).toBe(CONNECTION_STATUS.PENDING);
    });
});

describe('userService.getUserProfile', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        userRepository.getUserById.mockResolvedValue({
            id: 'user-1',
            company_email: 'user@example.com',
            mobile_number: '9999999999',
            country_code: '+91'
        });
        companyRepository.getCompanyById.mockResolvedValue({
            id: 'company-1',
            company_email: 'company@example.com',
            mobile_number: '8888888888',
            country_code: '+1',
            company_name: 'Acme'
        });
    });

    test('returns email, mobile and country code once, preferring the user row', async () => {
        userRepository.getUserProfileFieldsConfig.mockResolvedValue([
            { field_name: 'company_name', source_table: 'company', display_name: 'Company name', is_editable: false, type: 'string' },
            { field_name: 'company_email', source_table: 'company', display_name: 'Company Email', is_editable: true, type: 'string' },
            { field_name: 'mobile_number', source_table: 'company', display_name: 'Mobile Number', is_editable: true, type: 'string' },
            { field_name: 'country_code', source_table: 'company', display_name: 'Country Code', is_editable: true, type: 'string' },
            { field_name: 'company_email', source_table: 'user', display_name: 'Email', is_editable: true, type: 'string' },
            { field_name: 'mobile_number', source_table: 'user', display_name: 'Mobile Number', is_editable: true, type: 'string' },
            { field_name: 'country_code', source_table: 'user', display_name: 'Country Code', is_editable: true, type: 'string' }
        ]);

        const result = await userService.getUserProfile({
            companyId: 'company-1',
            userId: 'user-1',
            roleId: 2
        });

        expect(result.success).toBe(true);
        const names = result.data.map((f) => f.columnName);
        expect(names.filter((n) => n === 'company_email')).toHaveLength(1);
        expect(names.filter((n) => n === 'mobile_number')).toHaveLength(1);
        expect(names.filter((n) => n === 'country_code')).toHaveLength(1);
        expect(names).not.toContain('company_name');
        expect(result.data.find((f) => f.columnName === 'company_email').value).toBe('user@example.com');
        expect(result.data.find((f) => f.columnName === 'mobile_number').value).toBe('9999999999');
        expect(result.data.find((f) => f.columnName === 'country_code').value).toBe('+91');
    });
});
