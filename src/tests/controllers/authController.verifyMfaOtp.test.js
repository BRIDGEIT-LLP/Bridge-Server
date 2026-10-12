'use strict';

jest.mock('../../models', () => ({
    sequelize: {
        query: jest.fn(),
        transaction: jest.fn(),
        authenticate: jest.fn().mockResolvedValue(true)
    },
    Sequelize: {}
}));

jest.mock('../../services/authService', () => ({
    getCompanyByEmail: jest.fn(),
    getUserByEmail: jest.fn(),
    getUserCompanyRoleByCode: jest.fn()
}));

jest.mock('../../services/tokenService', () => ({
    generateMfaAccessToken: jest.fn(),
    generateTokens: jest.fn()
}));

jest.mock('../../services/otp.service', () => ({
    verifyOTP: jest.fn(),
    sendOTP: jest.fn()
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    on: jest.fn()
}));

const authService = require('../../services/authService');
const tokenService = require('../../services/tokenService');
const otpService = require('../../services/otp.service');
const authController = require('../../controllers/authController');
const { CHANNEL_TYPE, OTP_PURPOSE, REDIRECT_ROUTES, TOKEN_TYPES } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const createReq = (overrides = {}) => ({
    email: 'founder@example.com',
    userId: 'user-1',
    companyId: 'company-1',
    role: 'STARTUP',
    roleId: 1,
    userType: 'USER',
    body: { otp: '1234', channel: 'EMAIL' },
    ip: '127.0.0.1',
    headers: {},
    ...overrides
});

const baseCompany = {
    id: 'company-1',
    company_email: 'founder@example.com',
    mobile_number: '9876543210',
    country_code: '+91',
    company_name: 'Acme',
    is_email_verified: false,
    is_mobile_number_verified: false,
    is_kyc_uploaded: false,
    is_kyc_verified: false
};

const user = { id: 'user-1', first_name: 'Ada', last_name: 'Lovelace' };

describe('authController.verifyMfaOtp — pending channel OTPs', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authService.getCompanyByEmail.mockResolvedValue({ success: true, data: { ...baseCompany } });
        authService.getUserByEmail.mockResolvedValue({ success: true, data: user });
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { is_profile_completed: false }
        });
        otpService.verifyOTP.mockResolvedValue({ success: true });
        otpService.sendOTP.mockResolvedValue({ success: true, message: 'OTP - 1111' });
        tokenService.generateMfaAccessToken.mockResolvedValue({
            success: true,
            data: { accessToken: 'mfa-token' }
        });
    });

    test('sends registration OTPs for both unverified channels', async () => {
        const res = createRes();
        await authController.verifyMfaOtp(createReq(), res);

        expect(otpService.sendOTP).toHaveBeenCalledWith(
            CHANNEL_TYPE.EMAIL,
            'founder@example.com',
            OTP_PURPOSE.REGISTRATION
        );
        expect(otpService.sendOTP).toHaveBeenCalledWith(
            CHANNEL_TYPE.PHONE,
            '9876543210',
            OTP_PURPOSE.REGISTRATION
        );
        expect(otpService.sendOTP).toHaveBeenCalledTimes(2);

        const body = res.json.mock.calls[0][0];
        expect(body.data.redirectRoute).toBe(REDIRECT_ROUTES.REGISTRATION.VERIFY_COMPANY_ACCOUNT);
        expect(body.data.tokenType).toBe(TOKEN_TYPES.MFA_ACCESS_TOKEN);
        expect(body.data.isEmailVerified).toBe(false);
        expect(body.data.isPhoneVerified).toBe(false);
        expect(body.data.emailOtpMessage).toBe('OTP - 1111');
        expect(body.data.phoneOtpMessage).toBe('OTP - 1111');
        expect(body.data.channelOtpMessage).toBe('Email OTP - 1111 | Phone OTP - 1111');
    });

    test('sends only the phone OTP when email is already verified', async () => {
        authService.getCompanyByEmail.mockResolvedValue({
            success: true,
            data: { ...baseCompany, is_email_verified: true }
        });
        const res = createRes();
        await authController.verifyMfaOtp(createReq(), res);

        expect(otpService.sendOTP).toHaveBeenCalledTimes(1);
        expect(otpService.sendOTP).toHaveBeenCalledWith(
            CHANNEL_TYPE.PHONE,
            '9876543210',
            OTP_PURPOSE.REGISTRATION
        );

        const body = res.json.mock.calls[0][0];
        expect(body.data.isEmailVerified).toBe(true);
        expect(body.data.isPhoneVerified).toBe(false);
        expect(body.data.emailOtpMessage).toBeUndefined();
        expect(body.data.phoneOtpMessage).toBe('OTP - 1111');
        expect(body.data.channelOtpMessage).toBe('Phone OTP - 1111');
    });

    test('sends only the email OTP when phone is already verified', async () => {
        authService.getCompanyByEmail.mockResolvedValue({
            success: true,
            data: { ...baseCompany, is_mobile_number_verified: true }
        });
        const res = createRes();
        await authController.verifyMfaOtp(createReq(), res);

        expect(otpService.sendOTP).toHaveBeenCalledTimes(1);
        expect(otpService.sendOTP).toHaveBeenCalledWith(
            CHANNEL_TYPE.EMAIL,
            'founder@example.com',
            OTP_PURPOSE.REGISTRATION
        );

        const body = res.json.mock.calls[0][0];
        expect(body.data.isEmailVerified).toBe(false);
        expect(body.data.isPhoneVerified).toBe(true);
        expect(body.data.channelOtpMessage).toBe('Email OTP - 1111');
    });

    test('still redirects to verify-account when a pending OTP send hits cooldown', async () => {
        otpService.sendOTP.mockResolvedValue({
            success: false,
            message: 'Please wait 60 seconds before resend',
            statusCode: 429
        });
        const res = createRes();
        await authController.verifyMfaOtp(createReq(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        const body = res.json.mock.calls[0][0];
        expect(body.success).toBe(true);
        expect(body.data.redirectRoute).toBe(REDIRECT_ROUTES.REGISTRATION.VERIFY_COMPANY_ACCOUNT);
        expect(body.data.emailOtpMessage).toBeUndefined();
        expect(body.data.phoneOtpMessage).toBeUndefined();
    });

    test('does not send registration OTPs when both channels are already verified', async () => {
        authService.getCompanyByEmail.mockResolvedValue({
            success: true,
            data: {
                ...baseCompany,
                is_email_verified: true,
                is_mobile_number_verified: true,
                is_kyc_uploaded: true,
                is_kyc_verified: true
            }
        });
        authService.getUserCompanyRoleByCode.mockResolvedValue({
            success: true,
            data: { is_profile_completed: true }
        });
        tokenService.generateTokens.mockResolvedValue({
            data: { accessToken: 'at', refreshToken: 'rt' }
        });

        const res = createRes();
        await authController.verifyMfaOtp(createReq(), res);

        expect(otpService.sendOTP).not.toHaveBeenCalled();
        const body = res.json.mock.calls[0][0];
        expect(body.data.isEmailVerified).toBe(true);
        expect(body.data.isPhoneVerified).toBe(true);
        expect(body.data.tokenType).toBe(TOKEN_TYPES.AUTH_ACCESS_TOKEN);
    });
});
