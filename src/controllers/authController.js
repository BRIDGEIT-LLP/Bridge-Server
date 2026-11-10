'use strict';
const { errorLogger } = require('../configs/logger');
const authService = require('../services/authService');
const userService = require('../services/userService');
const otpService = require('../services/otp.service');
const tokenService = require('../services/tokenService');
const emailBlockService = require('../services/emailBlockService');
const gstVerificationService = require('../services/gstVerificationService');
const cinVerificationService = require('../services/cinVerificationService');
const userRepository = require('../repositories/userRepository');
const companyRepository = require('../repositories/companyRepository');
const { OTP_MESSAGES, OTP_PURPOSE, AUTH_MESSAGES, CHANNEL_TYPE, REGISTRATION_MESSAGES, USER_MESSAGES, LOGIN_MESSAGES, REDIRECT_ROUTES, TOKEN_TYPES, USER_TYPES, KYC_STATUS, ROLE_SWITCH_MESSAGES, GST_MESSAGES, CIN_MESSAGES, EMAIL_BLOCK_MESSAGES, BLOCK_REASONS, DRAFT_STEP_ROUTES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { maskPhone, maskEmail } = require('../utils/Helper');
const { COOKIE_NAMES, cookieOptions, clearCookieOptions } = require('../utils/token');
const env = require('../configs/env_configs');

/** Cookie options — httpOnly so JS can't read the token. */
const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,       // 1 day
};
const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days
};

/**
 * Blocked-email gate for the pre-authentication endpoints. Sends the response and
 * returns true when the request must stop: the email is blocked, or the lookup
 * failed (fails CLOSED — a blocked user is never let through on an error).
 *
 * `detailed` is only used at login, after the password has been verified: the
 * caller has proven they own the account, so the full blocking state (reason,
 * count, limit) can be returned without telling a stranger that an email is
 * registered-and-blocked. Registration and password reset use the generic message.
 */
const respondIfEmailBlocked = async (res, email, { detailed = false } = {}) => {
    const blockRes = await emailBlockService.checkEmail(email);
    if (!blockRes.success) {
        HttpResponse.error(res, { message: blockRes.message, statusCode: blockRes.statusCode });
        return true;
    }
    if (!blockRes.data.blocked) {
        return false;
    }

    const block = blockRes.data.block;
    if (!detailed) {
        HttpResponse.error(res, { message: EMAIL_BLOCK_MESSAGES.BLOCKED, statusCode: 403 });
        return true;
    }

    HttpResponse.error(res, {
        message: EMAIL_BLOCK_MESSAGES.BLOCKED_AFTER_REJECTION(block.rejection_limit),
        statusCode: 403,
        data: {
            isEmailBlocked: true,
            reason: block.reason ?? BLOCK_REASONS.KYC_REJECTED_MAX,
            kycRejectionCount: block.rejection_count,
            maxRejections: block.rejection_limit
        }
    });
    return true;
};

function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTS);
}

//  POST /api/v1/auth/company-registration
const companyRegistration = async (req, res, next) => {
    try {
        const { company_name, company_email: email, country_code, mobile_number: phoneNumber, password, role, termsAccepted } = req.body;

        if (!termsAccepted) {
            return HttpResponse.error(res, {
                message: 'You must accept the terms and conditions to register.',
                statusCode: 400
            });
        }

        // Before the existing-email check and before any OTP is sent, so a blocked
        // address never receives an SMS/email.
        if (await respondIfEmailBlocked(res, email)) {
            return;
        }

        const existingCompanyRes = await authService.getCompanyByEmail(email);
        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }

        // company_email is unique on both company and user, so check both before sending OTPs.
        const existingUserRes = await authService.getUserByEmail(email);
        if (!existingUserRes.success) {
            return HttpResponse.error(res, {
                message: existingUserRes.message,
                statusCode: existingUserRes.statusCode
            });
        }

        const existingCompany = existingCompanyRes.data;
        if (existingCompany || existingUserRes.data) {
            return HttpResponse.error(res, {message:USER_MESSAGES.EMAIL_ALREADY_EXISTS, statusCode:400});
        }

        // mobile_number is unique on both company and user; check before sending OTPs.
        const [mobileCompany, mobileUser] = await Promise.all([
            companyRepository.findByMobile(phoneNumber),
            userRepository.findByMobile(phoneNumber)
        ]);
        if (mobileCompany || mobileUser) {
            return HttpResponse.error(res, {message:USER_MESSAGES.MOBILE_ALREADY_EXISTS, statusCode:400});
        }

        // TODO: handle service response
        const emailOtpRes = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.REGISTRATION);
        if (!emailOtpRes.success) {
            return HttpResponse.error(res, {
                message: emailOtpRes.message || OTP_MESSAGES.OTP_SEND_FAILED,
                statusCode: 500
            });
        }
        const phoneOtpRes = await otpService.sendOTP(CHANNEL_TYPE.PHONE, phoneNumber, OTP_PURPOSE.REGISTRATION);
        if (!phoneOtpRes.success) {
            return HttpResponse.error(res, {
                message: phoneOtpRes.message || OTP_MESSAGES.OTP_SEND_FAILED,
                statusCode: 500
            });
        }
        
        // remove termsAccepted from payload before saving in db
        const createCompanyRes = await authService.createCompany({ company_name, company_email: email, country_code, mobile_number: phoneNumber, password, role, termsAccepted });
        if (!createCompanyRes.success) {
            return HttpResponse.error(res, { message: createCompanyRes.message, statusCode: createCompanyRes.statusCode });
        }
        
        const companyObj = createCompanyRes.data.company;
        const roleObj = createCompanyRes.data.role;
        const userObj = createCompanyRes.data.user;

        const userType = USER_TYPES[roleObj.role_code];
        const mfaTokenRes = await tokenService.generateMfaAccessToken(companyObj, roleObj, userObj, userType);
        if (!mfaTokenRes.success) {
            return HttpResponse.error(res, { message: mfaTokenRes.message, statusCode: 500 });
        }

        res.cookie(COOKIE_NAMES.MFA_TOKEN, mfaTokenRes.data.accessToken, cookieOptions(env.JWT.MFA_EXPIRY));

        // setAuthCookies(res, accessToken, refreshToken);
        return HttpResponse.success(res, {
            // TODO:- Remove OTP from Response
            // message: OTP_MESSAGES.SUCCESS,
            message: `Email ${emailOtpRes.message} | Phone ${phoneOtpRes.message}`,
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        console.error(error);
        return HttpResponse.error(res, {
            message: REGISTRATION_MESSAGES.COMPANY_CREATION_FAILED,
            statusCode: 500
        });
    }
};

//  POST /api/v1/auth/verify-gst
// Called by the frontend as soon as the user finishes typing a GSTIN (on field blur),
// ahead of the full registration submit, so it can show a live ✓ Verified / error toast.
const verifyGst = async (req, res) => {
    try {
        const { gstin } = req.body;
        const gstVerifyRes = await gstVerificationService.verifyGst(gstin);
        if (!gstVerifyRes.success) {
            return HttpResponse.error(res, {
                message: gstVerifyRes.message || GST_MESSAGES.VERIFY_FAILED,
                statusCode: gstVerifyRes.statusCode || 400
            });
        }
        return HttpResponse.success(res, {
            data: gstVerifyRes.data,
            message: gstVerifyRes.message || GST_MESSAGES.VERIFY_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        console.error(error);
        return HttpResponse.error(res, {
            message: GST_MESSAGES.VERIFICATION_SERVICE_ERROR,
            statusCode: 500
        });
    }
};

//  POST /api/v1/auth/verify-cin
// Mirrors verifyGst above. Currently backed by a fixed mock response pending a
// real CIN verification API (see cinVerificationService.js).
const verifyCin = async (req, res) => {
    try {
        const { cin } = req.body;
        const cinVerifyRes = await cinVerificationService.verifyCin(cin);
        if (!cinVerifyRes.success) {
            return HttpResponse.error(res, {
                message: cinVerifyRes.message || CIN_MESSAGES.VERIFY_FAILED,
                statusCode: cinVerifyRes.statusCode || 400
            });
        }
        return HttpResponse.success(res, {
            data: cinVerifyRes.data,
            message: cinVerifyRes.message || CIN_MESSAGES.VERIFY_SUCCESS,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        console.error(error);
        return HttpResponse.error(res, {
            message: CIN_MESSAGES.VERIFICATION_SERVICE_ERROR,
            statusCode: 500
        });
    }
};


//  POST /api/v1/auth/verify-otp
const verifyOtp = async (req, res, next) => {
    try {
        const { channel, otp, email, phoneNumber } = req.body;

        let result;
        let statusResult;
        if (channel === 'EMAIL') {
            result = await otpService.verifyOTP(email, otp, OTP_PURPOSE.REGISTRATION);
            if (!result.success) {
                return HttpResponse.error(res, {
                    message: result.message,
                    statusCode: result.statusCode
                });
            }
            statusResult = await authService.updateChannelVerifiedStatus('EMAIL', req.companyId);
        } else {
            result = await otpService.verifyOTP(phoneNumber, otp, OTP_PURPOSE.REGISTRATION);
            if (!result.success) {
                return HttpResponse.error(res, {
                    message: result.message,
                    statusCode: result.statusCode
                });
            }
            statusResult = await authService.updateChannelVerifiedStatus('PHONE', req.companyId);
        }

        if (!statusResult.success) {
            return HttpResponse.error(res, {
                message: statusResult.message,
                statusCode: statusResult.statusCode
            });
        }

        const user = await userRepository.findByEmail(req.email);
        const first_name = user?.first_name ?? null;
        const last_name = user?.last_name ?? null;
        const role = req.role ?? null;

        const companyData = statusResult.data;
        const roleObj = { role_code: req.role, id: req.roleId };

        // If both channels verified, set the full access token; otherwise keep the mfa token
        if (companyData.is_email_verified && companyData.is_mobile_number_verified) {
            const tokens = await tokenService.generateTokens(companyData, roleObj, user, req.userType, {
                ipAddress: req.ip,
                headers: req.headers
            });
            const { accessToken, refreshToken } = tokens.data;

            res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, cookieOptions(env.JWT.ACCESS_EXPIRY));
            res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, cookieOptions(env.JWT.REFRESH_EXPIRY));
            res.clearCookie(COOKIE_NAMES.MFA_TOKEN, clearCookieOptions());

            return HttpResponse.success(res, {
                message: OTP_MESSAGES.OTP_VERIFY_SUCCESS,
                data: { bothChannelsVerified: true, first_name, last_name, role },
                statusCode: 200
            });
        }

        const mfaTokenRes = await tokenService.generateMfaAccessToken(companyData, roleObj, user, req.userType);
        if (!mfaTokenRes.success) {
            return HttpResponse.error(res, { message: mfaTokenRes.message, statusCode: 500 });
        }
        res.cookie(COOKIE_NAMES.MFA_TOKEN, mfaTokenRes.data.accessToken, cookieOptions(env.JWT.MFA_EXPIRY));

        return HttpResponse.success(res, {
            message: OTP_MESSAGES.OTP_VERIFY_SUCCESS,
            data: { first_name, last_name, role },
            statusCode: 200,
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: OTP_MESSAGES.OTP_VERIFICATION_FAILED,
            statusCode: 500
        });
    }
};

//  POST /api/v1/auth/resend-otp
const resendOtp = async (req, res, next) => {
    try {
        const { channel, email, phoneNumber } = req.body;

        let result;
        if (channel === 'EMAIL') {
            result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.REGISTRATION);
        } else {
            result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, phoneNumber, OTP_PURPOSE.REGISTRATION);
        }

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: 400
            });
        }

        return HttpResponse.success(res, {
            // TODO:- Remove OTP from Response
            // message: OTP_MESSAGES.OTP_SEND_SUCCESS,
            message: result.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: OTP_MESSAGES.OTP_GENERATION_FAILED,
            statusCode: 500
        });
    }
};

//  POST /api/v1/auth/refresh
const updateAccessToken = async (req, res, next) => {
    try {
        const { refreshToken } = req.body;
        const result = await tokenService.refreshToken(refreshToken);

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: 401
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: AUTH_MESSAGES.TOKEN_REFRESH_FAILED,
            statusCode: 500
        });
    }
};

//  POST /api/v1/auth/login
const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const existingCompanyRes = await authService.getCompanyByEmail(email);

        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }

        const existingCompany = existingCompanyRes.data;

        if (!existingCompany) {
            return HttpResponse.error(res, {
                message: LOGIN_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 400
            });
        }

        const lockStatus = await authService.checkLoginLockStatus(existingCompany);
        if (lockStatus.locked) {
            return HttpResponse.error(res, {
                message: lockStatus.message,
                statusCode: 403
            });
        }

        const passwordRes = await authService.checkPassword(
            password,
            existingCompany.password
        );

        if (!passwordRes.success) {
            const attemptResult = await authService.registerFailedLoginAttempt(existingCompany.id);
            if (attemptResult.locked) {
                return HttpResponse.error(res, {
                    message: attemptResult.message,
                    statusCode: 403
                });
            }
            return HttpResponse.error(res, {
                message: LOGIN_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 400
            });
        }

        if (existingCompany.failed_login_attempts > 0) {
            await authService.resetLoginAttempts(existingCompany.id);
        }

        // After the password check on purpose (see respondIfEmailBlocked), and before
        // any MFA token is issued so a blocked user is not pushed into the OTP step.
        if (await respondIfEmailBlocked(res, email, { detailed: true })) {
            return;
        }

        const existingUserRes = await authService.getUserByEmail(email);

        if (!existingUserRes.success) {
            return HttpResponse.error(res, {
                message: LOGIN_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 400
            });
        }

        const existingUser = existingUserRes.data;

        const companyUserRoleRes =
            await authService.getCompanyUser_role(
                existingCompany.id,
                existingUser.id
            );

        if (!companyUserRoleRes) {
            return HttpResponse.error(res, {
                message: LOGIN_MESSAGES.INVALID_CREDENTIALS,
                statusCode: 400
            });
        }

        // rest unchanged
        const role = companyUserRoleRes.data;

        const maskedMobile = maskPhone(existingCompany.country_code + existingCompany.mobile_number);
        const maskedEmail = maskEmail(existingCompany.company_email);

        const userType = USER_TYPES[role.role_code];
        const tokens = await tokenService.generateMfaAccessToken(existingCompany, role, existingUser, userType);
        const { accessToken } = tokens.data;

        // Reminder on every sign-in from the first KYC rejection until approval.
        // Built before any cookie is set; it never throws (returns null on error).
        const kycRejection = await emailBlockService.buildKycRejectionWarning(existingCompany);

        res.cookie(COOKIE_NAMES.MFA_TOKEN, accessToken, cookieOptions(env.JWT.MFA_EXPIRY));
        return HttpResponse.success( res, {data: { role: role.role_code, maskedMobile, maskedEmail, ...(kycRejection && { kycRejection }) }, message: LOGIN_MESSAGES.VALID_CREDENTIALS })
    } catch (error) {
        console.error(error)
        errorLogger.error(error);
        return HttpResponse.error(res, { message: AUTH_MESSAGES.LOGIN_FAILED, statusCode: 500 });
    }
};

//  POST /api/v1/auth/login/otp
// One-time-code sign-in: no password. Looks the account up by email or mobile number,
// issues the same pre-MFA cookie as /login and sends the OTP to the channel the user
// typed. The code is then checked by the existing /mfa/verify-otp, which also decides
// the redirect route from the user's registration progress.
const loginWithOtp = async (req, res, next) => {
    try {
        const identifier = req.body.identifier.trim();
        const isEmail = identifier.includes('@');
        const channel = isEmail ? CHANNEL_TYPE.EMAIL : CHANNEL_TYPE.PHONE;
        const maskedDestination = isEmail ? maskEmail(identifier) : maskPhone(identifier);

        // Identical response for "no such account" and "code sent" (no cookie, no OTP
        // in the first case) so the endpoint can't be used to probe registered accounts.
        const genericResponse = () => HttpResponse.success(res, {
            data: { channel, maskedDestination },
            message: LOGIN_MESSAGES.OTP_LOGIN_SENT,
            statusCode: 200
        });

        const companyRes = isEmail
            ? await authService.getCompanyByEmail(identifier)
            : await authService.getCompanyByMobile(identifier);
        if (!companyRes.success) {
            return HttpResponse.error(res, { message: companyRes.message, statusCode: companyRes.statusCode });
        }

        const company = companyRes.data;
        if (!company) {
            return genericResponse();
        }

        // Same password-attempt lockout /login enforces; an OTP login must not bypass it.
        const lockStatus = await authService.checkLoginLockStatus(company);
        if (lockStatus.locked) {
            return HttpResponse.error(res, { message: lockStatus.message, statusCode: 403 });
        }

        // Before any token or OTP is issued, so a blocked user is not pushed into the OTP step.
        if (await respondIfEmailBlocked(res, company.company_email)) {
            return;
        }

        const userRes = await authService.getUserByEmail(company.company_email);
        if (!userRes.success) {
            return HttpResponse.error(res, { message: userRes.message, statusCode: userRes.statusCode });
        }
        const user = userRes.data;
        if (!user) {
            return genericResponse();
        }

        const companyUserRoleRes = await authService.getCompanyUser_role(company.id, user.id);
        const role = companyUserRoleRes && companyUserRoleRes.data;
        if (!role) {
            return genericResponse();
        }

        const userType = USER_TYPES[role.role_code];
        const tokens = await tokenService.generateMfaAccessToken(company, role, user, userType);
        if (!tokens.success) {
            return HttpResponse.error(res, { message: tokens.message, statusCode: 500 });
        }

        // Cookie first, so /mfa/resend-otp keeps working if this send is rate-limited.
        res.cookie(COOKIE_NAMES.MFA_TOKEN, tokens.data.accessToken, cookieOptions(env.JWT.MFA_EXPIRY));

        const otpRes = await otpService.sendOTP(
            channel,
            isEmail ? company.company_email : company.mobile_number,
            OTP_PURPOSE.LOGIN_MFA
        );
        if (!otpRes.success) {
            return HttpResponse.error(res, { message: otpRes.message, statusCode: otpRes.statusCode || 400 });
        }

        const kycRejection = await emailBlockService.buildKycRejectionWarning(company);

        return HttpResponse.success(res, {
            data: {
                channel,
                maskedDestination,
                role: role.role_code,
                maskedMobile: maskPhone(company.country_code + company.mobile_number),
                maskedEmail: maskEmail(company.company_email),
                ...(kycRejection && { kycRejection })
            },
            // TODO:- Remove OTP from Response (same dev-only behaviour as /mfa/trigger-otp):
            // otpService's message carries the code so the UI can toast it. Switch back to
            // LOGIN_MESSAGES.OTP_LOGIN_SENT before production.
            message: otpRes.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: AUTH_MESSAGES.LOGIN_FAILED, statusCode: 500 });
    }
};

//  POST /api/v1/auth/trigger-otp
const triggerOtp =async (req, res, next) => {
    try {
        const email = req.email;
        const mobileNumber = req.mobileNumber;

        const { channel } = req.body;

        let result;
        if (channel === CHANNEL_TYPE.EMAIL) {
            result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.LOGIN_MFA);
        } else {
            result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, mobileNumber, OTP_PURPOSE.LOGIN_MFA);
        }

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: OTP_MESSAGES.OTP_GENERATION_FAILED, statusCode: 500 });
    }
};

/**
 * Login MFA succeeded but email/mobile are still unverified — the client is sent to
 * /registration/verify-account, which verifies REGISTRATION OTPs. Send a fresh code
 * only for channels that are not yet verified. A 429 (resend cooldown) means a prior
 * registration OTP is still valid, so it is ignored rather than failing MFA.
 */
const sendPendingRegistrationOtps = async (company) => {
    const isEmailVerified = Boolean(company.is_email_verified);
    const isPhoneVerified = Boolean(company.is_mobile_number_verified);
    let emailOtpMessage;
    let phoneOtpMessage;

    if (!isEmailVerified && company.company_email) {
        const result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, company.company_email, OTP_PURPOSE.REGISTRATION);
        if (result.success) {
            emailOtpMessage = result.message;
        } else {
            errorLogger.error(`[verifyMfaOtp] Email registration OTP not sent: ${result.message}`);
        }
    }

    if (!isPhoneVerified && company.mobile_number) {
        const result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, company.mobile_number, OTP_PURPOSE.REGISTRATION);
        if (result.success) {
            phoneOtpMessage = result.message;
        } else {
            errorLogger.error(`[verifyMfaOtp] Phone registration OTP not sent: ${result.message}`);
        }
    }

    // Same shape as company-registration: "Email OTP - 1234 | Phone OTP - 5678"
    const parts = [];
    if (emailOtpMessage) parts.push(`Email ${emailOtpMessage}`);
    if (phoneOtpMessage) parts.push(`Phone ${phoneOtpMessage}`);

    return {
        isEmailVerified,
        isPhoneVerified,
        emailOtpMessage,
        phoneOtpMessage,
        channelOtpMessage: parts.length ? parts.join(' | ') : undefined
    };
};

const verifyMfaOtp = async (req, res, next) => {
    try {
        const email = req.email;

        const existingCompanyRes = await authService.getCompanyByEmail(email);
        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }

        const existingUserRes = await authService.getUserByEmail(email);
        if (!existingUserRes.success) {
            return HttpResponse.error(res, {
                message: existingUserRes.message,
                statusCode: existingUserRes.statusCode
            });
        }

        const company = existingCompanyRes.data;
        const mobileNumber = company.mobile_number;
        const user = existingUserRes.data;

        const { otp, channel } = req.body;
        let channelId = channel === CHANNEL_TYPE.EMAIL ? email : mobileNumber;

        const verifyOtpRes = await otpService.verifyOTP(channelId, otp, OTP_PURPOSE.LOGIN_MFA);

        if (!verifyOtpRes.success) {
            return HttpResponse.error(res, { message: verifyOtpRes.message, statusCode: verifyOtpRes.statusCode });
        }

        const companyUserRoleRes = await authService.getUserCompanyRoleByCode(req.userId, req.companyId, req.role);
        const isProfileCompleted = !!companyUserRoleRes.data?.is_profile_completed;
        const draftRoute = DRAFT_STEP_ROUTES[companyUserRoleRes.data?.draft_step];

        let redirectRoute = REDIRECT_ROUTES.DASHBOARD.DASHBOARD;
        if (!company.is_email_verified || !company.is_mobile_number_verified) {
            redirectRoute = REDIRECT_ROUTES.REGISTRATION.VERIFY_COMPANY_ACCOUNT;
        } else if (draftRoute && !company.is_kyc_uploaded) {
            // a saved draft: pick up at the step it was saved from
            redirectRoute = draftRoute;
        } else if (!isProfileCompleted) {
            redirectRoute = REDIRECT_ROUTES.REGISTRATION.BUILD_USER_PROFILE;
        } else if (!company.is_kyc_uploaded) {
            redirectRoute = REDIRECT_ROUTES.REGISTRATION.UPLOAD_KYC_DOCUMENTS;
        } else if (!company.is_kyc_verified) {
            redirectRoute = REDIRECT_ROUTES.REGISTRATION.PENDING_KYC_APPROVAL;
        } else {
            redirectRoute = REDIRECT_ROUTES.DASHBOARD.DASHBOARD;
        }


        const role = { role_code: req.role, id: req.roleId };

        const isEmailVerified = Boolean(company.is_email_verified);
        const isPhoneVerified = Boolean(company.is_mobile_number_verified);

        if (redirectRoute === REDIRECT_ROUTES.REGISTRATION.VERIFY_COMPANY_ACCOUNT) {
            // Channels still unverified — re-issue the mfa_token (instead of promoting to a
            // full access token) so /verify-otp and /resend-otp keep working on that page.
            const mfaTokenRes = await tokenService.generateMfaAccessToken(company, role, user, req.userType);
            if (!mfaTokenRes.success) {
                return HttpResponse.error(res, { message: mfaTokenRes.message, statusCode: 500 });
            }
            res.cookie(COOKIE_NAMES.MFA_TOKEN, mfaTokenRes.data.accessToken, cookieOptions(env.JWT.MFA_EXPIRY));

            const pendingOtps = await sendPendingRegistrationOtps(company);

            return HttpResponse.success(res, { message: OTP_MESSAGES.OTP_VERIFY_SUCCESS, data: { userId: user.id, tokenType: TOKEN_TYPES.MFA_ACCESS_TOKEN, redirectRoute: redirectRoute, isEmailVerified: pendingOtps.isEmailVerified, isPhoneVerified: pendingOtps.isPhoneVerified, isKycVerified: company.is_kyc_verified, first_name: user.first_name, last_name: user.last_name, email: company.company_email, mobileNumber: company.mobile_number, countryCode: company.country_code, role: role.role_code, companyName: company.company_name, emailOtpMessage: pendingOtps.emailOtpMessage, phoneOtpMessage: pendingOtps.phoneOtpMessage, channelOtpMessage: pendingOtps.channelOtpMessage }, statusCode: 200 });
        }

        const tokens = await tokenService.generateTokens(company, role, user, req.userType, {
            ipAddress: req.ip,
            headers: req.headers          // full headers — parseDeviceInfo reads sec-ch-ua* from these
        });
        const { accessToken, refreshToken } = tokens.data;

        const kycRejection = await emailBlockService.buildKycRejectionWarning(company);

        res.clearCookie(COOKIE_NAMES.MFA_TOKEN, clearCookieOptions());
        res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, cookieOptions(env.JWT.ACCESS_EXPIRY));
        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, cookieOptions(env.JWT.REFRESH_EXPIRY));
        return HttpResponse.success(res, { message: OTP_MESSAGES.OTP_VERIFY_SUCCESS, data: { userId: user.id, tokenType: TOKEN_TYPES.AUTH_ACCESS_TOKEN, redirectRoute: redirectRoute, isEmailVerified, isPhoneVerified, isKycVerified: company.is_kyc_verified, first_name: user.first_name, last_name: user.last_name, role: role.role_code, companyName: company.company_name, ...(kycRejection && { kycRejection }) }, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: OTP_MESSAGES.OTP_VERIFICATION_FAILED, statusCode: 500 });
    }
};

const resendMfaOtp = async (req, res, next) => {
    try {
        const email = req.email;
        const mobileNumber = req.mobileNumber;
        const { channel } = req.body;

        let result;
        if (channel === 'EMAIL') {
            result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.LOGIN_MFA);
        } else {
            result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, mobileNumber, OTP_PURPOSE.LOGIN_MFA);
        }

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: 400
            });
        }

        return HttpResponse.success(res, {
            // TODO:- Remove OTP from Response
            // message: OTP_MESSAGES.OTP_SEND_SUCCESS,
            message: result.message,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: OTP_MESSAGES.OTP_GENERATION_FAILED,
            statusCode: 500
        });
    }
};

const resetPasswordTriggerOtp = async (req, res, next) => {
    try {
        const { email } = req.body;

        const existingCompanyRes = await authService.getCompanyByEmail(email);
        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }
        const existingCompany = existingCompanyRes.data;
        if (!existingCompany) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.USER_NOT_FOUND,
                statusCode: 400
            });
        }

        if (await respondIfEmailBlocked(res, email)) {
            return;
        }

        const result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.RESET_PASSWORD);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: 400
            });
        }

        return HttpResponse.success(res, {
            // TODO:- Remove OTP from Response
            // message: OTP_MESSAGES.OTP_SEND_SUCCESS,
            message: result.message,
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: OTP_MESSAGES.OTP_GENERATION_FAILED,
            statusCode: 500
        });
    }
}

const resetPasswordVerifyOtp = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        const existingCompanyRes = await authService.getCompanyByEmail(email);
        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }

        const company = existingCompanyRes.data;
        if (!company) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.USER_NOT_FOUND,
                statusCode: 400
            });
        }

        if (await respondIfEmailBlocked(res, email)) {
            return;
        }

        const tokenRes = await tokenService.generateResetPasswordAcessToken(email);
        if (!tokenRes.success) {
            return HttpResponse.error(res, { message: tokenRes.message, statusCode: tokenRes.statusCode });
        }

        const accessToken = tokenRes.data.accessToken;

        const verifyOtpRes = await otpService.verifyOTP(email, otp, OTP_PURPOSE.RESET_PASSWORD);

        if (!verifyOtpRes.success) {
            return HttpResponse.error(res, { message: verifyOtpRes.message, statusCode: verifyOtpRes.statusCode });
        }

        res.cookie(COOKIE_NAMES.RESET_TOKEN, accessToken, cookieOptions(env.JWT.RESET_PASSWORD_EXPIRY));

        return HttpResponse.success(res, { message: OTP_MESSAGES.OTP_VERIFY_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: OTP_MESSAGES.OTP_VERIFICATION_FAILED, statusCode: 500 });
    }
};

const resetPassword = async (req, res, next) => {
    try {
        const email = req.email;
        const { newPassword } = req.body;

        const existingCompanyRes = await authService.getCompanyByEmail(email);
        if (!existingCompanyRes.success) {
            return HttpResponse.error(res, {
                message: existingCompanyRes.message,
                statusCode: existingCompanyRes.statusCode
            });
        }

        const company = existingCompanyRes.data;
        if (!company) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.USER_NOT_FOUND,
                statusCode: 400
            });
        }

        if (await respondIfEmailBlocked(res, email)) {
            return;
        }

        const result = await authService.resetPassword(email, newPassword);
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }
        res.clearCookie(COOKIE_NAMES.RESET_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, { message: result.message, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: AUTH_MESSAGES.PASSWORD_RESET_FAILED, statusCode: 500 });
    }
};

//  GET /api/v1/auth/switch-role-details
const getSwitchRoleDetails = async (req, res) => {
    try {
        const { roleCode } = req.query;
        const result = await authService.getSwitchRoleDetails(req.userId, req.companyId, roleCode);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode,
                data: result.data
            });
        }
        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.DETAILS_FAILED, statusCode: 500 });
    }
};

//  POST /api/v1/auth/request-role-switch
const requestRoleSwitch = async (req, res) => {
    try {
        const { roleCode, ...profilePayload } = req.body;

        const roleRes = await authService.getUserCompanyRoleByCode(req.userId, req.companyId, roleCode);
        if (!roleRes.success) {
            return HttpResponse.error(res, { message: roleRes.message, statusCode: roleRes.statusCode });
        }

        const existing = roleRes.data;
        if (existing) {
            if (existing.status === KYC_STATUS.REJECTED) {
                return HttpResponse.error(res, {
                    message: existing.rejection_reason || USER_MESSAGES.PROFILE_REJECTED,
                    statusCode: 200,
                    data: { status: existing.status, rejectionReason: existing.rejection_reason }
                });
            }
            if (existing.status === KYC_STATUS.APPROVED) {
                return HttpResponse.error(res, {
                    message: ROLE_SWITCH_MESSAGES.ALREADY_APPROVED,
                    statusCode: 400,
                    data: { status: existing.status }
                });
            }
            if (existing.is_profile_completed) {
                return HttpResponse.error(res, {
                    message: USER_MESSAGES.PROFILE_PENDING_APPROVAL,
                    statusCode: 200,
                    data: { status: existing.status, isProfileCompleted: true }
                });
            }
        }

        if (Object.keys(profilePayload).length > 0) {
            const updateRes = await userService.updateUserProfile(profilePayload, req.userId, req.companyId);
            if (!updateRes.success) {
                return HttpResponse.error(res, {
                    message: updateRes.message,
                    data: updateRes.data,
                    statusCode: updateRes.statusCode
                });
            }
        }

        const submitRes = await authService.submitRoleSwitchRequest(req.userId, req.companyId, roleCode);
        if (!submitRes.success) {
            return HttpResponse.error(res, {
                message: submitRes.message,
                statusCode: submitRes.statusCode,
                data: submitRes.data
            });
        }

        return HttpResponse.success(res, {
            message: submitRes.message,
            data: submitRes.data,
            statusCode: submitRes.statusCode
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.REQUEST_FAILED, statusCode: 500 });
    }
};

//  POST /api/v1/auth/switch-role
const switchRole = async (req, res, next) => {
    try {
        const { roleCode } = req.body;

        const roleRes = await authService.getUserCompanyRoleByCode(req.userId, req.companyId, roleCode);
        if (!roleRes.success) {
            return HttpResponse.error(res, { message: roleRes.message, statusCode: roleRes.statusCode });
        }

        const roleInfo = roleRes.data;
        if (!roleInfo) {
            return HttpResponse.error(res, {
                message: ROLE_SWITCH_MESSAGES.NOT_REQUESTED,
                statusCode: 400
            });
        }

        if (!roleInfo.is_profile_completed) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.PROFILE_NOT_COMPLETED,
                statusCode: 400
            });
        }

        if (roleInfo.status === KYC_STATUS.REJECTED) {
            return HttpResponse.error(res, {
                message: roleInfo.rejection_reason || USER_MESSAGES.PROFILE_REJECTED,
                statusCode: 200,
                data: { status: roleInfo.status, rejectionReason: roleInfo.rejection_reason }
            });
        }

        if (roleInfo.status !== KYC_STATUS.APPROVED) {
            return HttpResponse.error(res, {
                message: USER_MESSAGES.PROFILE_PENDING_APPROVAL,
                statusCode: 200,
                data: { status: roleInfo.status }
            });
        }

        const companyUserRes = await authService.getCompanyAndUser(req.companyId, req.userId);
        if (!companyUserRes.success) {
            return HttpResponse.error(res, { message: companyUserRes.message, statusCode: companyUserRes.statusCode });
        }
        const { company, user } = companyUserRes.data;

        const role = { id: roleInfo.role_id, role_code: roleInfo.role_code };
        const userType = USER_TYPES[roleInfo.role_code];

        const tokens = await tokenService.generateTokens(company, role, user, userType, {
            ipAddress: req.ip,
            headers: req.headers
        });
        const { accessToken, refreshToken } = tokens.data;

        res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, cookieOptions(env.JWT.ACCESS_EXPIRY));
        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, cookieOptions(env.JWT.REFRESH_EXPIRY));

        return HttpResponse.success(res, {
            message: 'Role switched successfully.',
            data: { roleId: role.id, role: role.role_code }
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.SWITCH_FAILED, statusCode: 500 });
    }
};

module.exports = {
    companyRegistration,
    verifyGst,
    verifyCin,
    verifyOtp,
    resendOtp,
    updateAccessToken,
    login,
    loginWithOtp,
    triggerOtp,
    verifyMfaOtp,
    resendMfaOtp,
    resetPasswordTriggerOtp,
    resetPasswordVerifyOtp,
    resetPassword,
    getSwitchRoleDetails,
    requestRoleSwitch,
    switchRole
};