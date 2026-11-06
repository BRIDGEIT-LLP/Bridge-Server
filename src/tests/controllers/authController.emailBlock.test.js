'use strict';

jest.mock('../../models', () => ({
    sequelize: { query: jest.fn(), transaction: jest.fn(), authenticate: jest.fn().mockResolvedValue(true) },
    Sequelize: {}
}));

jest.mock('../../services/authService', () => ({
    getCompanyByEmail: jest.fn(),
    getUserByEmail: jest.fn(),
    getCompanyUser_role: jest.fn(),
    checkLoginLockStatus: jest.fn(),
    checkPassword: jest.fn(),
    registerFailedLoginAttempt: jest.fn(),
    resetLoginAttempts: jest.fn(),
    createCompany: jest.fn(),
    resetPassword: jest.fn()
}));

jest.mock('../../services/tokenService', () => ({
    generateMfaAccessToken: jest.fn(),
    generateResetPasswordAcessToken: jest.fn()
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

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../configs/redis', () => ({
    get: jest.fn(), set: jest.fn(), del: jest.fn(), on: jest.fn()
}));

const authService = require('../../services/authService');
const tokenService = require('../../services/tokenService');
const otpService = require('../../services/otp.service');
const emailBlockService = require('../../services/emailBlockService');
const authController = require('../../controllers/authController');
const { EMAIL_BLOCK_MESSAGES } = require('../../utils/constant');

const createRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res;
};

const notBlocked = { success: true, data: { blocked: false, block: null } };
const blocked = {
    success: true,
    data: {
        blocked: true,
        block: { reason: 'KYC_REJECTED_MAX', rejection_count: 3, rejection_limit: 3 }
    }
};

const company = {
    id: 'company-1', company_email: 'founder@acme.io', password: 'hash',
    country_code: '+91', mobile_number: '9876543210', failed_login_attempts: 0
};

describe('authController.login — blocked email', () => {
    const req = () => ({ body: { email: 'founder@acme.io', password: 'Passw0rd!' } });

    beforeEach(() => {
        jest.clearAllMocks();
        authService.getCompanyByEmail.mockResolvedValue({ success: true, data: company });
        authService.checkLoginLockStatus.mockResolvedValue({ locked: false });
        authService.checkPassword.mockResolvedValue({ success: true });
        authService.getUserByEmail.mockResolvedValue({ success: true, data: { id: 'user-1' } });
        authService.getCompanyUser_role.mockResolvedValue({ data: { role_code: 'STARTUP', id: 1 } });
        tokenService.generateMfaAccessToken.mockResolvedValue({ success: true, data: { accessToken: 'mfa' } });
        emailBlockService.checkEmail.mockResolvedValue(notBlocked);
        emailBlockService.buildKycRejectionWarning.mockResolvedValue(null);
    });

    test('correct password + blocked: 403 with the blocking state and NO mfa token', async () => {
        emailBlockService.checkEmail.mockResolvedValue(blocked);
        const res = createRes();

        await authController.login(req(), res);

        expect(res.status).toHaveBeenCalledWith(403);
        const body = res.json.mock.calls[0][0];
        expect(body.message).toBe(EMAIL_BLOCK_MESSAGES.BLOCKED_AFTER_REJECTION(3));
        expect(body.data).toMatchObject({ isEmailBlocked: true, kycRejectionCount: 3, maxRejections: 3 });
        expect(tokenService.generateMfaAccessToken).not.toHaveBeenCalled();
        expect(res.cookie).not.toHaveBeenCalled();
    });

    test('wrong password + blocked: generic invalid credentials, block state is not revealed', async () => {
        emailBlockService.checkEmail.mockResolvedValue(blocked);
        authService.checkPassword.mockResolvedValue({ success: false });
        authService.registerFailedLoginAttempt.mockResolvedValue({ locked: false });
        const res = createRes();

        await authController.login(req(), res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(emailBlockService.checkEmail).not.toHaveBeenCalled();
        expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/blocked/i);
    });

    test('block lookup failure fails closed (503), no mfa token', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: false, message: 'x', statusCode: 503 });
        const res = createRes();

        await authController.login(req(), res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(tokenService.generateMfaAccessToken).not.toHaveBeenCalled();
    });

    test('not blocked, prior rejections: login succeeds and carries the warning', async () => {
        const kycRejection = { kycRejectionCount: 1, maxRejections: 3, attemptsRemaining: 2 };
        emailBlockService.buildKycRejectionWarning.mockResolvedValue(kycRejection);
        const res = createRes();

        await authController.login(req(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.kycRejection).toEqual(kycRejection);
    });

    test('not blocked, no rejections: no warning key in the response', async () => {
        const res = createRes();

        await authController.login(req(), res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data).not.toHaveProperty('kycRejection');
    });
});

describe('authController.companyRegistration — blocked email', () => {
    const body = {
        company_name: 'Acme', company_email: 'founder@acme.io', country_code: '+91', mobile_number: '9876543210',
        password: 'Passw0rd!', role: 'STARTUP', termsAccepted: true
    };

    beforeEach(() => jest.clearAllMocks());

    test('blocked: 403 generic message, and no OTP is sent', async () => {
        emailBlockService.checkEmail.mockResolvedValue(blocked);
        const res = createRes();

        await authController.companyRegistration({ body }, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json.mock.calls[0][0].message).toBe(EMAIL_BLOCK_MESSAGES.BLOCKED);
        expect(authService.getCompanyByEmail).not.toHaveBeenCalled();
        expect(otpService.sendOTP).not.toHaveBeenCalled();
        expect(authService.createCompany).not.toHaveBeenCalled();
    });

    test('lookup failure fails closed: no OTP, no company created', async () => {
        emailBlockService.checkEmail.mockResolvedValue({ success: false, message: 'x', statusCode: 503 });
        const res = createRes();

        await authController.companyRegistration({ body }, res);

        expect(res.status).toHaveBeenCalledWith(503);
        expect(otpService.sendOTP).not.toHaveBeenCalled();
    });
});

describe('authController — password reset for a blocked email', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        authService.getCompanyByEmail.mockResolvedValue({ success: true, data: company });
        emailBlockService.checkEmail.mockResolvedValue(blocked);
    });

    test('trigger-otp is refused before any OTP is sent', async () => {
        const res = createRes();
        await authController.resetPasswordTriggerOtp({ body: { email: 'founder@acme.io' } }, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(otpService.sendOTP).not.toHaveBeenCalled();
    });

    test('verify-otp is refused before the OTP is checked or a reset token is issued', async () => {
        const res = createRes();
        await authController.resetPasswordVerifyOtp({ body: { email: 'founder@acme.io', otp: '1234' } }, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(otpService.verifyOTP).not.toHaveBeenCalled();
        expect(tokenService.generateResetPasswordAcessToken).not.toHaveBeenCalled();
    });

    test('reset-password is refused before the password changes', async () => {
        const res = createRes();
        await authController.resetPassword({ email: 'founder@acme.io', body: { newPassword: 'NewPassw0rd!' } }, res);
        expect(res.status).toHaveBeenCalledWith(403);
        expect(authService.resetPassword).not.toHaveBeenCalled();
    });
});
