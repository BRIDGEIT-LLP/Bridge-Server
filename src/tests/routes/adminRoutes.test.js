'use strict';

// Keep the router's controller/service imports DB-free.
jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

// configs/redis opens a real ioredis connection on require, which keeps the
// Jest process alive after the assertions finish.
jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn(), info: jest.fn() },
    accessLogger: { info: jest.fn() }
}));

const adminRoutes = require('../../routes/adminRoutes');

/**
 * Returns the names of the handlers wired to the first route matching
 * `method path`, read straight off the Express router stack. This asserts
 * middleware *wiring* without needing an HTTP client.
 */
const handlersFor = (method, path) => {
    const layer = adminRoutes.stack.find(
        (l) => l.route && l.route.path === path && l.route.methods[method]
    );

    if (!layer) {
        throw new Error(`No ${method.toUpperCase()} route registered for ${path}`);
    }

    return layer.route.stack.map((s) => s.handle.name);
};

describe('adminRoutes MFA login flow wiring', () => {
    /*
     * The MFA endpoints run *before* the admin has an ACCESS_TOKEN cookie —
     * adminController.login only sets MFA_TOKEN, which is exchanged for the
     * full token pair by verify-otp. Guarding any of them with adminMiddleware
     * makes the step unreachable (401 on a cookie that cannot exist yet).
     */
    test.each([
        '/auth/mfa/trigger-otp',
        '/auth/mfa/verify-otp',
        '/auth/mfa/resend-otp'
    ])('%s is guarded by adminMfaMiddleware, not adminMiddleware', (path) => {
        const handlers = handlersFor('post', path);

        expect(handlers).toContain('adminMfaMiddleware');
        expect(handlers).not.toContain('adminMiddleware');
    });

    test('/auth/login is publicly reachable (no auth middleware)', () => {
        const handlers = handlersFor('post', '/auth/login');

        expect(handlers).not.toContain('adminMiddleware');
        expect(handlers).not.toContain('adminMfaMiddleware');
    });
});
