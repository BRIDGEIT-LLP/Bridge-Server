'use strict';

// adminService pulls in repositories that touch the DB/redis at require time
// via ../models and ../configs/redis — keep this test DB-free, same as
// src/tests/routes/adminRoutes.test.js.
jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() },
    accessLogger: { info: jest.fn() }
}));

const adminService = require('../../services/adminService');

/*
 * Regression guard: getAdminProfile/updateAdminProfile were defined in this
 * file but dropped from module.exports when it was collapsed onto one line,
 * which silently broke GET/PUT /admin/profile (adminController calls these
 * by name off the imported module).
 */
describe('adminService module.exports', () => {
    test.each([
        'login',
        'findByEmail',
        'getAdminProfile',
        'updateAdminProfile',
        'getUserLimitConfig',
        'updateUserLimitConfig',
        'updateUserSuspension',
        'updateRoleSwitchStatus',
        'getMatchingEngineStats'
    ])('exports %s as a function', (name) => {
        expect(typeof adminService[name]).toBe('function');
    });
});
