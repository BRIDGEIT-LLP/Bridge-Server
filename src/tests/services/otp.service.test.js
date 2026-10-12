'use strict';

const mockStore = new Map();

jest.mock('../../configs/redis', () => ({
    get: jest.fn(async (key) => (mockStore.has(key) ? mockStore.get(key) : null)),
    set: jest.fn(async (key, value) => {
        mockStore.set(key, value);
        return 'OK';
    }),
    del: jest.fn(async (key) => {
        mockStore.delete(key);
        return 1;
    }),
    incr: jest.fn(async (key) => {
        const next = Number(mockStore.get(key) || 0) + 1;
        mockStore.set(key, String(next));
        return next;
    }),
    expire: jest.fn(async () => 1),
    on: jest.fn()
}));

jest.mock('../../configs/twilio', () => ({
    smsClient: { messages: { create: jest.fn() } },
    sgMailClient: { send: jest.fn() }
}));

jest.mock('../../configs/logger', () => ({
    errorLogger: { error: jest.fn() }
}));

jest.mock('../../services/adminConfigService', () => ({
    getOtpConfigValue: jest.fn()
}));

jest.mock('../../utils/Helper', () => ({
    generateOTP: jest.fn()
}));

const adminConfigService = require('../../services/adminConfigService');
const { generateOTP } = require('../../utils/Helper');
const { CHANNEL_TYPE, OTP_PURPOSE, OTP_MESSAGES } = require('../../utils/constant');
const otpService = require('../../services/otp.service');

const EMAIL = 'founder@example.com';

const CONFIG = {
    SENT_OTP_TTL: 180,
    RESEND_COOLDOWN_TTL: 60,
    MAX_OTP_RESEND_COUNT_IN_HR: 10,
    OTP_RESEND_COUNT_TTL_IN_HR: 3600,
    OTP_BLOCK_TTL: 3600,
    MAX_OTP_VERIFY_ATTEMPTS: 3
};

describe('otp.service purpose-scoped keys', () => {
    beforeEach(() => {
        mockStore.clear();
        jest.clearAllMocks();
        adminConfigService.getOtpConfigValue.mockImplementation(async (key) => CONFIG[key]);
        generateOTP.mockReset();
    });

    test('login MFA send succeeds within the registration cooldown window', async () => {
        generateOTP.mockReturnValueOnce('1111').mockReturnValueOnce('2222');

        const registration = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        expect(registration.success).toBe(true);
        expect(mockStore.get(`otp_resend:${OTP_PURPOSE.REGISTRATION}:${EMAIL}`)).toBe('true');

        const loginMfa = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.LOGIN_MFA);
        expect(loginMfa.success).toBe(true);
        expect(loginMfa.message).toContain('2222');
        expect(mockStore.get(`otp:${OTP_PURPOSE.LOGIN_MFA}:${EMAIL}`)).toBe('2222');
        expect(mockStore.get(`otp:${OTP_PURPOSE.REGISTRATION}:${EMAIL}`)).toBe('1111');
    });

    test('same-purpose resend within cooldown returns 429', async () => {
        generateOTP.mockReturnValue('1111');

        const first = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        const second = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);

        expect(first.success).toBe(true);
        expect(second.success).toBe(false);
        expect(second.statusCode).toBe(429);
        expect(second.message).toBe(OTP_MESSAGES.RESEND_TIMER);
    });

    test('cooldown check does not delete the existing OTP', async () => {
        generateOTP.mockReturnValue('1111');

        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);

        expect(mockStore.get(`otp:${OTP_PURPOSE.REGISTRATION}:${EMAIL}`)).toBe('1111');

        const verify = await otpService.verifyOTP(EMAIL, '1111', OTP_PURPOSE.REGISTRATION);
        expect(verify.success).toBe(true);
    });

    test('a registration OTP cannot verify login MFA', async () => {
        generateOTP.mockReturnValueOnce('1111').mockReturnValueOnce('2222');

        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.LOGIN_MFA);

        const wrongPurpose = await otpService.verifyOTP(EMAIL, '1111', OTP_PURPOSE.LOGIN_MFA);
        expect(wrongPurpose.success).toBe(false);
        expect(wrongPurpose.message).toMatch(/Invalid OTP/);

        const rightPurpose = await otpService.verifyOTP(EMAIL, '2222', OTP_PURPOSE.LOGIN_MFA);
        expect(rightPurpose.success).toBe(true);
    });

    test('reset-password send is independent of the registration cooldown', async () => {
        generateOTP.mockReturnValueOnce('1111').mockReturnValueOnce('3333');

        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        const reset = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.RESET_PASSWORD);

        expect(reset.success).toBe(true);
        expect(reset.message).toContain('3333');
    });

    test('max verify attempts on one purpose sets a global block', async () => {
        generateOTP.mockReturnValueOnce('1111').mockReturnValueOnce('2222');

        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.REGISTRATION);
        await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.LOGIN_MFA);

        await otpService.verifyOTP(EMAIL, '0000', OTP_PURPOSE.REGISTRATION);
        await otpService.verifyOTP(EMAIL, '0000', OTP_PURPOSE.REGISTRATION);
        const blocked = await otpService.verifyOTP(EMAIL, '0000', OTP_PURPOSE.REGISTRATION);

        expect(blocked.success).toBe(false);
        expect(blocked.statusCode).toBe(403);
        expect(mockStore.get(`otp_block:${EMAIL}`)).toBe('true');

        const loginSend = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, EMAIL, OTP_PURPOSE.LOGIN_MFA);
        expect(loginSend.success).toBe(false);
        expect(loginSend.statusCode).toBe(403);

        const loginVerify = await otpService.verifyOTP(EMAIL, '2222', OTP_PURPOSE.LOGIN_MFA);
        expect(loginVerify.success).toBe(false);
        expect(loginVerify.statusCode).toBe(403);
    });

});
