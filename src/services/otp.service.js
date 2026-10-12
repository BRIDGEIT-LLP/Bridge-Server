// Fixed: Passed strings to require() and removed destructuring for redis instance
const redis = require("../configs/redis.js");
const { OTP_MESSAGES } = require("../utils/constant.js");
const { generateOTP } = require("../utils/Helper.js");
const { smsClient } = require("../configs/twilio.js");
const { sgMailClient } = require("../configs/twilio.js");
const ServiceResponse = require("../utils/ServiceResponse.js");
const { errorLogger } = require("../configs/logger.js");
const { CHANNEL_TYPE } = require("../utils/constant.js")
const adminConfigService = require("./adminConfigService.js");

const sendOtpToPhone = async (phone, otp) => {
    try {
        const id = await smsClient.messages.create({
            body: `Your OTP is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone,
        });
        // console.log(`OTP sent to phone ${phone}, message SID: ${id}`);
    } catch (err) {
        errorLogger.error(`Error sending OTP to phone ${phone}:`, err);
        console.error(`Error sending OTP to phone ${phone}:`, err);
        throw new Error("Failed to send OTP");
    }
};

const sendOtpToEmail = async (email, otp) => {
    try {
        const msg = {
            to: email,
            from: {
                name: "Bridge Support",
                email: process.env.SENDGRID_EMAIL_FROM
            },
            subject: "Bridge OTP Verification",
            html: `<p>Your OTP is <strong>${otp}</strong></p>`,
        };
        await sgMailClient.send(msg);
    } catch (err) {
        errorLogger.error(`Error sending OTP to email ${email}:`, err);
        console.error(`Error sending OTP to email ${email}:`, err);
        throw new Error("Failed to send OTP");
    }
};

const sendOTP = async (channelType, channelId, purpose) => {
    try {
        // 1. Check block
        const blocked = await redis.get(`otp_block:${channelId}`);
        if (blocked) {
            return ServiceResponse.error({ message: OTP_MESSAGES.BLOCKED, statusCode: 403 });
        }

        // 2. Check resend timer
        const resendExists = await redis.get(`otp_resend:${purpose}:${channelId}`);
        if (resendExists) {
            return ServiceResponse.error({ message: OTP_MESSAGES.RESEND_TIMER, statusCode: 429 });
        }

        // 3. Check resend count
        const resendCount = await redis.get(`otp_resend_count:${channelId}`);
        const maxResend = await adminConfigService.getOtpConfigValue('MAX_OTP_RESEND_COUNT_IN_HR');
        if (resendCount && Number(resendCount) >= maxResend) {
            return ServiceResponse.error({ message: OTP_MESSAGES.MAX_RESEND, statusCode: 400 });
        }

        // 4. Generate OTP
        const otp = generateOTP();
        console.log(`Generated OTP for channel ${channelId}: ${otp}`);

        // 5. Save OTP
        const otpTtl = await adminConfigService.getOtpConfigValue('SENT_OTP_TTL');
        await redis.set(`otp:${purpose}:${channelId}`, otp, "EX", otpTtl);

        // 6. Create resend cooldown
        const resendTtl = await adminConfigService.getOtpConfigValue('RESEND_COOLDOWN_TTL');
        await redis.set(
            `otp_resend:${purpose}:${channelId}`,
            "true",
            "EX",
            resendTtl
        );

        // Reset attempt count on new OTP
        await redis.del(`otp_attempt:${purpose}:${channelId}`);

        // 7. Send OTP via appropriate channel
        if (channelType === CHANNEL_TYPE.PHONE) {
            // TODO:- Remove hardcoded phone number and use channelId instead after testing
            // await sendOtpToPhone("+91" + channelId, otp);
        } else {
            // await sendOtpToEmail(channelId, otp);
        }

        // 8. Increment OTP resent count
        const newCount = await redis.incr(`otp_resend_count:${channelId}`);
        if (newCount === 1) {
            const resendCountTtl = (await adminConfigService.getOtpConfigValue('OTP_RESEND_COUNT_TTL_IN_HR')) || 3600;
            await redis.expire(
                `otp_resend_count:${channelId}`,
                resendCountTtl
            );
        }

        // TODO:- Stop returning the OTP in the message once real SMS/email delivery
        // is enabled. It is exposed so the web can show it in a toast while testing.
        return ServiceResponse.success({
            message: `OTP - ${otp}`,
            // message: OTP_MESSAGES.OTP_SEND_SUCCESS,
        });

    } catch (err) {
        console.error(`Error in send OTP for channel ${channelId}:`, err);
        await redis.del(`otp:${purpose}:${channelId}`);
        await redis.del(`otp_attempt:${purpose}:${channelId}`);
        errorLogger.error(err);
        return ServiceResponse.error({
            message: OTP_MESSAGES.OTP_GENERATION_FAILED,
            statusCode: 500
        });
    }
};

const verifyOTP = async (channelId, enteredOTP, purpose) => {
    try {
        // 1. Check blocked
        const blocked = await redis.get(`otp_block:${channelId}`);

        if (blocked) {
            return ServiceResponse.error({ message: OTP_MESSAGES.BLOCKED, statusCode: 403 });
        }

        // 2. Get stored OTP
        const savedOTP = await redis.get(`otp:${purpose}:${channelId}`);

        if (!savedOTP) {
            return ServiceResponse.error({ message: "OTP expired", statusCode: 400 });
        }

        // 3. Compare OTP
        if (savedOTP !== enteredOTP) {

            // Increase attempt count
            const attempts = await redis.incr(`otp_attempt:${purpose}:${channelId}`);

            // Set expiry only on first wrong attempt
            if (attempts === 1) {
                const otpTtl = await adminConfigService.getOtpConfigValue('SENT_OTP_TTL');
                await redis.expire(
                    `otp_attempt:${purpose}:${channelId}`,
                    otpTtl
                );
            }

            // Block after max attempts
            const maxAttempts = await adminConfigService.getOtpConfigValue('MAX_OTP_VERIFY_ATTEMPTS');
            if (attempts >= maxAttempts) {

                // Block user for the configured resend-TTL duration
                const blockDuration = await adminConfigService.getOtpConfigValue('OTP_BLOCK_TTL');
                await redis.set(
                    `otp_block:${channelId}`,
                    "true",
                    "EX",
                    blockDuration
                );

                // Cleanup
                await redis.del(`otp:${purpose}:${channelId}`);
                await redis.del(`otp_attempt:${purpose}:${channelId}`);

                return ServiceResponse.error({ message: OTP_MESSAGES.BLOCKED, statusCode: 403 });
            }

            return ServiceResponse.error({ message: `Invalid OTP. Attempts left: ${maxAttempts - attempts}`, statusCode: 400 });
        }

        // Success cleanup
        await redis.del(`otp:${purpose}:${channelId}`);
        await redis.del(`otp_resend:${purpose}:${channelId}`);
        await redis.del(`otp_resend_count:${channelId}`)
        await redis.del(`otp_attempt:${purpose}:${channelId}`);

        return ServiceResponse.success({
            message: OTP_MESSAGES.OTP_VERIFY_SUCCESS,
            statusCode: 200
        });

    } catch (err) {
        console.error(`Error in verifyOTP for channel ${channelId}:`, err);
        errorLogger.error(err);
        return ServiceResponse.error({
            message: OTP_MESSAGES.OTP_VERIFICATION_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    sendOTP,
    verifyOTP,
};
