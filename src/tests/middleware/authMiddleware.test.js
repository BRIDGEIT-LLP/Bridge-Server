'use strict';

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../utils/token', () => ({
    verifyAccessToken: jest.fn(),
    COOKIE_NAMES: { ACCESS_TOKEN: 'accessToken' }
}));

jest.mock('../../repositories/userSessionRepository', () => ({
    getActiveSessionsByUser: jest.fn(),
    findSessionByJti: jest.fn(),
    updateLastActivity: jest.fn()
}));

jest.mock('../../repositories/sessionCacheRepository', () => ({
    checkJti: jest.fn(),
    cacheActiveJtis: jest.fn()
}));

const { TOKEN_TYPES } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

const createReq = () => ({ cookies: { accessToken: 'a.b.c' } });

/*
 * SESSION_LIMIT_ENABLED is read once at module load, so the middleware has to
 * be re-required per flag value with the config module mocked accordingly.
 */
const loadMiddleware = (sessionLimitEnabled) => {
    let middleware;

    jest.isolateModules(() => {
        jest.doMock('../../configs/sessionConfig', () => ({
            SESSION_LIMIT_ENABLED: sessionLimitEnabled,
            MAX_ACTIVE_SESSIONS: 3,
            SESSION_CACHE_TTL_SECONDS: 2700
        }));
        middleware = require('../../middleware/authMiddleware');
    });

    return middleware;
};

const token = require('../../utils/token');
const userSessionRepository = require('../../repositories/userSessionRepository');
const sessionCacheRepository = require('../../repositories/sessionCacheRepository');

const decodedFor = (overrides = {}) => ({
    type: TOKEN_TYPES.AUTH_ACCESS_TOKEN,
    jti: 'jti-1',
    userId: 42,
    role: 'B2B',
    userType: 'USER',
    ...overrides
});

describe('authMiddleware session validation', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        userSessionRepository.updateLastActivity.mockResolvedValue(undefined);
        sessionCacheRepository.cacheActiveJtis.mockResolvedValue(undefined);
    });

    describe('with SESSION_LIMIT_ENABLED=true', () => {
        let authMiddleware;

        beforeEach(() => {
            authMiddleware = loadMiddleware(true);
        });

        test('rejects a user whose session JTI has been revoked', async () => {
            token.verifyAccessToken.mockReturnValue(decodedFor());
            sessionCacheRepository.checkJti.mockResolvedValue('REVOKED');

            const res = createRes();
            const next = jest.fn();

            await authMiddleware(createReq(), res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
            expect(userSessionRepository.updateLastActivity).not.toHaveBeenCalled();
        });

        test('rejects a user whose JTI is absent from the DB on a cache miss', async () => {
            token.verifyAccessToken.mockReturnValue(decodedFor());
            sessionCacheRepository.checkJti.mockResolvedValue('MISS');
            userSessionRepository.getActiveSessionsByUser.mockResolvedValue([
                { token_jti: 'some-other-jti' }
            ]);

            const res = createRes();
            const next = jest.fn();

            await authMiddleware(createReq(), res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
        });

        test('allows a user with a valid session and touches last activity', async () => {
            token.verifyAccessToken.mockReturnValue(decodedFor());
            sessionCacheRepository.checkJti.mockResolvedValue('VALID');

            const res = createRes();
            const next = jest.fn();

            await authMiddleware(createReq(), res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
            expect(userSessionRepository.updateLastActivity).toHaveBeenCalledWith(42, 'jti-1');
        });

        test('rejects a user token that carries no jti', async () => {
            token.verifyAccessToken.mockReturnValue(decodedFor({ jti: undefined }));

            const res = createRes();
            const next = jest.fn();

            await authMiddleware(createReq(), res, next);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(next).not.toHaveBeenCalled();
            expect(sessionCacheRepository.checkJti).not.toHaveBeenCalled();
        });

        test.each(['ADMIN', 'SUPER_ADMIN'])(
            'skips session validation entirely for userType %s',
            async (userType) => {
                token.verifyAccessToken.mockReturnValue(
                    decodedFor({ userType, role: userType, userId: undefined })
                );

                const res = createRes();
                const next = jest.fn();

                await authMiddleware(createReq(), res, next);

                expect(next).toHaveBeenCalled();
                expect(res.status).not.toHaveBeenCalled();
                expect(sessionCacheRepository.checkJti).not.toHaveBeenCalled();
                expect(userSessionRepository.updateLastActivity).not.toHaveBeenCalled();
            }
        );
    });

    describe('with SESSION_LIMIT_ENABLED=false', () => {
        test('skips session validation for a regular user', async () => {
            const authMiddleware = loadMiddleware(false);
            token.verifyAccessToken.mockReturnValue(decodedFor());

            const res = createRes();
            const next = jest.fn();

            await authMiddleware(createReq(), res, next);

            expect(next).toHaveBeenCalled();
            expect(sessionCacheRepository.checkJti).not.toHaveBeenCalled();
            expect(userSessionRepository.updateLastActivity).not.toHaveBeenCalled();
        });
    });
});
