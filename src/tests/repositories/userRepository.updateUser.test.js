'use strict';

jest.mock('../../models', () => ({
    User: {
        rawAttributes: {
            first_name: {},
            is_active: {},
            is_user_suspended: {},
            created_by: {},
            updated_by: {},
            company_email: {},
            password: {},
            id: {}
        },
        update: jest.fn()
    },
    UserProfileFieldMaster: { findAll: jest.fn() },
    sequelize: { query: jest.fn() }
}));

const { User, UserProfileFieldMaster } = require('../../models');
const userRepository = require('../../repositories/userRepository');

describe('userRepository.updateUser mass-assignment', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        UserProfileFieldMaster.findAll.mockResolvedValue([
            { field_name: 'first_name', lookup: null }
        ]);
        User.update.mockResolvedValue([1, [{ id: 'u1', first_name: 'Ada', is_active: false }]]);
    });

    test('drops is_active, is_user_suspended, and audit fields on self-service updates', async () => {
        await userRepository.updateUser({
            first_name: 'Ada',
            is_active: true,
            is_user_suspended: false,
            created_by: 'attacker',
            updated_by: 'attacker',
            company_email: 'spoof@example.com'
        }, 'u1');

        const written = User.update.mock.calls[0][0];
        expect(written.first_name).toBe('Ada');
        expect(written).not.toHaveProperty('is_active');
        expect(written).not.toHaveProperty('is_user_suspended');
        expect(written).not.toHaveProperty('created_by');
        expect(written).not.toHaveProperty('updated_by');
        expect(written).not.toHaveProperty('company_email');
        expect(written).toHaveProperty('updated_at');
    });

    test('writes is_user_suspended when allowPrivileged is true', async () => {
        await userRepository.updateUser(
            { is_user_suspended: true },
            'u1',
            { allowPrivileged: true }
        );

        expect(User.update.mock.calls[0][0].is_user_suspended).toBe(true);
        expect(UserProfileFieldMaster.findAll).not.toHaveBeenCalled();
    });
});
