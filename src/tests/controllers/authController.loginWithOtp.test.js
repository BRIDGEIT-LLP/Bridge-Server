'use strict';

jest.mock('../../models', () => ({
    sequelize: { query: jest.fn(), transaction: jest.fn(), authenticate: jest.fn().mockResolvedValue(true) },
    Sequelize: {}
}));

jest.mock('../../services/authService', () => ({
    getCompanyByEmail: jest.fn(),
    getCompanyByMobile: jest.fn(),
    getUserByEmail: jest.fn(),
    getCompanyUser_role: jest.fn(),
    checkLoginLockStatus: jest.fn()
}));

jest.mock('../../services/tokenService', () => ({
    generateMfaAccessToken: jest.fn()
}));

jest.mock('../../services/otp.service', () => ({
    sendOTP: jest.fn(),
    verifyOTP: jest.fn()
}));

jest.mock('../../services/emailBlockService', () => ({
    checkEmail: jest.fn(),
    buildKycRejectionWarning: jest.fn()
}));

jest.mock('../../services/gstVerificationService', () => ({ verifyGst: jest.fn() }));
jest.mock('../../services/cinVerificationService', () => ({ verifyCin: jest.fn() }));
jest.mock('../../services/userService', () => ({}));
jest.mock('../../repositories/userRepository', () => ({}));
jest.mock('../../utils/encryption', () => ({ decrypt: jest.fn(), encrypt: jest.fn() }));
jest.mock('../../configs/logger', () => ({ errorLogger: { error: jest.fn() } }));
jest.mock('../../configs/redis', () => ({
    get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn()
}));

const authService = require('../../services/authService');
const tokenService = require('../../services/tokenService');
const otpService = require('../../services/otp.service');
const emailBlockService = require('../../services/emailBlockService');
const authController = require('../../controllers/authController');
const { loginOtpSchema } = require('../../validations/authValidation');
const { LOGIN_MESSAGES, OTP_PURPOSE, CHANNEL_TYPE } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const company = {
    id: 'company-1', company_email: 'founder@acme.io',
    country_code: '+91', mobile_number: '9876543210'
};

describe('authController.loginWithOtp', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authService.getCompanyByEmail.mockResolvedValue({ success: true, data: company });
        authService.getCompanyByMobile.mockResolvedValue({ success: true, data: company });
        authService.checkLoginLockStatus.mockResolvedValue({ locked: false });
        authService.getUserByEmail.mockResolvedValue({ success: true, data: { id: 'user-1' } });
        authService.getCompanyUser_role.mockResolvedValue({ data: { role_code: 'STARTUP', id: 1 } });
        tokenService.generateMfaAccessToken.mockResolvedValue({ success: true, data: { accessToken: 'mfa' } });
        emailBlockService.checkEmail.mockResolvedValue({ success: true, data: { blocked: false } });
        emailBlockService.buildKycRejectionWarning.mockResolvedValue(null);
        otpService.sendOTP.mockResolvedValue({ success: true, message: 'sent' });
    });

    test('mobile number: looks up by mobile, sets mfa cookie, sends PHONE otp', async () => {
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: '9876543210' } }, res);

        expect(authService.getCompanyByMobile).toHaveBeenCalledWith('9876543210');
        expect(authService.getCompanyByEmail).not.toHaveBeenCalled();
        expect(res.cookie).toHaveBeenCalledWith('mfa_token', 'mfa', expect.any(Object));
        expect(otpService.sendOTP).toHaveBeenCalledWith(CHANNEL_TYPE.PHONE, '9876543210', OTP_PURPOSE.LOGIN_MFA);
        expect(res.status).toHaveBeenCalledWith(200);
        // The otp service's message (which carries the code in dev) is passed through for the toast.
        expect(res.json.mock.calls[0][0].message).toBe('sent');
        expect(res.json.mock.calls[0][0].data).toMatchObject({ channel: CHANNEL_TYPE.PHONE, role: 'STARTUP' });
    });

    test('email: looks up by email and sends EMAIL otp', async () => {
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: 'founder@acme.io' } }, res);

        expect(authService.getCompanyByEmail).toHaveBeenCalledWith('founder@acme.io');
        expect(otpService.sendOTP).toHaveBeenCalledWith(CHANNEL_TYPE.EMAIL, 'founder@acme.io', OTP_PURPOSE.LOGIN_MFA);
        expect(res.status).toHaveBeenCalledWith(200);
    });

    test('unknown account: same success message, no cookie, no otp', async () => {
        authService.getCompanyByMobile.mockResolvedValue({ success: true, data: null });
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: '9000000000' } }, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].message).toBe(LOGIN_MESSAGES.OTP_LOGIN_SENT);
        expect(res.cookie).not.toHaveBeenCalled();
        expect(otpService.sendOTP).not.toHaveBeenCalled();
    });

    test('locked account: 403, no cookie, no otp', async () => {
        authService.checkLoginLockStatus.mockResolvedValue({ locked: true, message: 'locked' });
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: '9876543210' } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.cookie).not.toHaveBeenCalled();
        expect(otpService.sendOTP).not.toHaveBeenCalled();
    });

    test('blocked email: 403, no cookie, no otp', async () => {
        emailBlockService.checkEmail.mockResolvedValue({
            success: true, data: { blocked: true, block: { rejection_limit: 3 } }
        });
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: '9876543210' } }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(tokenService.generateMfaAccessToken).not.toHaveBeenCalled();
        expect(res.cookie).not.toHaveBeenCalled();
        expect(otpService.sendOTP).not.toHaveBeenCalled();
    });

    test('otp send failure (e.g. cooldown): returns its status', async () => {
        otpService.sendOTP.mockResolvedValue({ success: false, message: 'wait', statusCode: 429 });
        const res = createRes();

        await authController.loginWithOtp({ body: { identifier: '9876543210' } }, res);

        expect(res.status).toHaveBeenCalledWith(429);
    });
});

describe('loginOtpSchema', () => {
    test.each(['founder@acme.io', '9876543210'])('accepts %s', (identifier) => {
        expect(loginOtpSchema.validate({ identifier }).error).toBeUndefined();
    });

    test.each(['', 'abc', '12345', '+919876543210'])('rejects %p', (identifier) => {
        expect(loginOtpSchema.validate({ identifier }).error).toBeDefined();
    });
});
