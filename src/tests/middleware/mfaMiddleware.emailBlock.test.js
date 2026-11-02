'use strict';

jest.mock('../../utils/token', () => ({
    verifyAccessToken: jest.fn(),
    COOKIE_NAMES: { MFA_TOKEN: 'mfa_token' },
    clearCookieOptions: jest.fn(() => ({}))
}));

jest.mock('../../services/emailBlockService', () => ({
    checkEmail: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

const token = require('../../utils/token');
const emailBlockService = require('../../services/emailBlockService');
const mfaMiddleware = require('../../middleware/mfaMiddleware');
const { TOKEN_TYPES, EMAIL_BLOCK_MESSAGES } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const req = () => ({ cookies: { mfa_token: 'tok' } });

describe('mfaMiddleware — blocked email', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        token.verifyAccessToken.mockReturnValue({
            type: TOKEN_TYPES.MFA_ACCESS_TOKEN, email: 'founder@acme.io', userId: 'u1', companyId: 'c1'
        });
    });

    test('lets a not-blocked user through and attaches the payload', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: false } });
        const next = jest.fn();
        const r = req();

        await mfaMiddleware(r, createRes(), next);

        expect(emailBlockService.checkEmail).toHaveBeenCalledWith('founder@acme.io');
        expect(next).toHaveBeenCalled();
        expect(r.userId).toBe('u1');
    });

    test('rejects a blocked email with 403 and clears the mfa cookie', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: true } });
        const next = jest.fn();
        const res = createRes();

        await mfaMiddleware(req(), res, next);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0].message).toBe(EMAIL_BLOCK_MESSAGES.BLOCKED);
        expect(res.clearCookie).toHaveBeenCalled();
        expect(next).not.toHaveBeenCalled();
    });

    test('fails closed when the block lookup errors', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: false, message: 'x', statusCode: 503 });
        const next = jest.fn();
        const res = createRes();

        await mfaMiddleware(req(), res, next);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(next).not.toHaveBeenCalled();
    });
});
