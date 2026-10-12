'use strict';
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const {
    ADMIN_MESSAGES, OTP_MESSAGES, OTP_PURPOSE, CHANNEL_TYPE, REDIRECT_ROUTES, KYC_MESSAGES,
    USER_LIMIT_CONFIG_MESSAGES, TOKEN_TYPES, USER_TYPES, SESSION_MESSAGES,
    USER_SUSPENSION_MESSAGES, ROLE_SWITCH_MESSAGES, USER_MESSAGES, ADMIN_PROFILE_MESSAGES,
    ADMIN_USER_DETAIL_MESSAGES
} = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { isValidUUID } = require('../utils/Helper');
const { errorLogger } = require('../configs/logger');
const adminService = require('../services/adminService');
const otpService = require('../services/otp.service');
const userService = require('../services/userService');
const kycService = require('../services/kycService');
const { COOKIE_NAMES, cookieOptions, clearCookieOptions, generateAccessToken, generateRefreshToken } = require('../utils/token');
const env = require('../configs/env_configs');
const { NATIONAL_NUMBER_PATTERN } = require('../utils/phoneValidation');
const { SESSION_LIMIT_ENABLED } = require('../configs/sessionConfig');
const adminSessionService = require('../services/adminSessionService');
const { parseDeviceInfo } = require('../utils/deviceInfo');

const ACCESS_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
};
const REFRESH_COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
};
function setAuthCookies(res, accessToken, refreshToken) {
    res.cookie('access_token', accessToken, ACCESS_COOKIE_OPTS);
    res.cookie('refresh_token', refreshToken, REFRESH_COOKIE_OPTS);
}

const updateLimitConfigSchema = Joi.object({
    allowed_connections: Joi.number().integer().min(0).optional(),
    allowed_free_trial_days: Joi.number().integer().min(0).optional(),
    allowed_premium_days: Joi.number().integer().min(0).optional()
}).min(1).messages({
    'object.min': 'At least one limit configuration field must be provided'
});

// ── Admin Self-Service Profile — Validation Schema ────────────────────────────
// Only editable fields are accepted: name, country_code, mobile_number.
// Email and role are not updatable through this endpoint.
const updateAdminProfileSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'name must be at least 2 characters long',
        'string.max': 'name must not exceed 100 characters'
    }),
    country_code: Joi.string().max(5).optional().allow(null, '').messages({
        'string.max': 'country_code must not exceed 5 characters'
    }),
    mobile_number: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).optional().allow(null, '').messages({
        'string.pattern.base': 'mobile_number must be a valid national number for the selected country'
    })
}).or('name', 'country_code', 'mobile_number').messages({
    'object.missing': 'At least one field must be provided for update'
});

const login = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        const result = await adminService.login(email, password);
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        const { mfaToken, ...body } = result.data;
        res.cookie(COOKIE_NAMES.MFA_TOKEN, mfaToken, cookieOptions(env.JWT.MFA_EXPIRY));
        return HttpResponse.success(res, { message: result.message, data: body, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MESSAGES.LOGIN_FAILED, statusCode: 500 });
    }
};

const triggerOtp = async (req, res, next) => {
    try {
        const email = req.email;
        const mobileNumber = req.mobileNumber;

        const { channel } = req.body;

        let result;
        if (channel === CHANNEL_TYPE.EMAIL) {
            result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.ADMIN_MFA);
        } else {
            result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, mobileNumber, OTP_PURPOSE.ADMIN_MFA);
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

const verifyMfaOtp = async (req, res, next) => {
    try {
        const email = req.email;
        const mobileNumber = req.mobileNumber;

        const { otp, channel } = req.body;
        let channelId = channel === CHANNEL_TYPE.EMAIL ? email : mobileNumber;

        const verifyOtpRes = await otpService.verifyOTP(channelId, otp, OTP_PURPOSE.ADMIN_MFA);

        if (!verifyOtpRes.success) {
            return HttpResponse.error(res, { message: verifyOtpRes.message, statusCode: verifyOtpRes.statusCode });
        }

        let redirectRoute = REDIRECT_ROUTES.DASHBOARD.DASHBOARD;

        const adminRes = await adminService.findByEmail(email);
        if (!adminRes.success) {
            return HttpResponse.error(res, { message: adminRes.message, statusCode: adminRes.statusCode });
        }

        const admin = adminRes.data;

        const userType = USER_TYPES[admin.role];
        if (!userType) {
            errorLogger.error(`Admin OTP verification blocked: unmapped role "${admin.role}" for admin id ${admin.id}`);
            return HttpResponse.error(res, { message: OTP_MESSAGES.OTP_VERIFICATION_FAILED, statusCode: 500 });
        }

        const jti = uuidv4();
        const payload = {
            jti,
            adminId: admin.id,
            email: admin.email,
            mobileNumber: admin.mobile_number,
            role: admin.role,
            userType
        };
        const accessToken = generateAccessToken(payload);
        const refreshToken = generateRefreshToken(payload);

        res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, cookieOptions(env.JWT.ACCESS_EXPIRY));
        res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, cookieOptions(env.JWT.REFRESH_EXPIRY));
        res.clearCookie(COOKIE_NAMES.MFA_TOKEN, clearCookieOptions());

        // Create admin session row and prime the Redis cache.
        // Best-effort session creation — routed through the service layer so
        // no repository is called directly from the controller. Failure is
        // logged but never blocks login (the service swallows it internally).
        if (SESSION_LIMIT_ENABLED) {
            const deviceInfo = parseDeviceInfo(req.headers);
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days, mirrors refresh token
            const sessionResult = await adminSessionService.createAndCacheSession(
                { id: admin.id }, jti, deviceInfo, req.ip, expiresAt
            );
            if (!sessionResult.success) {
                errorLogger.error('[adminController.verifyMfaOtp] Session creation failed:', sessionResult.message);
            }
        }

        return HttpResponse.success(res, {
            message: OTP_MESSAGES.OTP_VERIFY_SUCCESS,
            data: {
                userId: admin.id,
                tokenType: TOKEN_TYPES.AUTH_ACCESS_TOKEN,
                first_name: admin.name,
                role: admin.role,
                redirectRoute
            },
            statusCode: 200
        });
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
            result = await otpService.sendOTP(CHANNEL_TYPE.EMAIL, email, OTP_PURPOSE.ADMIN_MFA);
        } else {
            result = await otpService.sendOTP(CHANNEL_TYPE.PHONE, mobileNumber, OTP_PURPOSE.ADMIN_MFA);
        }

        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: 400
            });
        }

        return HttpResponse.success(res, {
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

const getUserList = async (req, res, next) => {
    try {
        const userListRes = await userService.getUserList();
        if (!userListRes.success) {
            return HttpResponse.error(res, { message: userListRes.message, statusCode: userListRes.statusCode });
        }

        const userList = userListRes.data;

        return HttpResponse.success(res, { message: userListRes.message, data: userList, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: 'Failed to fetch user list.', statusCode: 500 });
    }
};


const getSwitchedRoleUsers = async (req, res, next) => {
    try {
        const usersRes = await userService.getSwitchedRoleUsers();
        if (!usersRes.success) {
            return HttpResponse.error(res, { message: usersRes.message, statusCode: usersRes.statusCode });
        }

        return HttpResponse.success(res, { message: usersRes.message, data: usersRes.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { data: [], statusCode: 500 });
    }
};

const getRoleSwitchUserDetails = async (req, res, next) => {
    try {
        const { userId, companyId } = req.query;
        const roleId = parseInt(req.query.roleId, 10);

        if (!userId || !isValidUUID(userId)) {
            return HttpResponse.error(res, { message: USER_MESSAGES.USER_ID_REQUIRED, statusCode: 400 });
        }
        if (!companyId || !isValidUUID(companyId)) {
            return HttpResponse.error(res, { message: USER_MESSAGES.COMPANY_ID_REQUIRED, statusCode: 400 });
        }
        if (!req.query.roleId || isNaN(roleId) || roleId <= 0) {
            return HttpResponse.error(res, { message: USER_MESSAGES.ROLE_ID_REQUIRED, statusCode: 400 });
        }

        const detailsRes = await userService.getRoleSwitchUserDetails({ companyId, userId, roleId });
        if (!detailsRes.success) {
            return HttpResponse.error(res, {
                message: detailsRes.message,
                data: detailsRes.data,
                statusCode: detailsRes.statusCode
            });
        }

        return HttpResponse.success(res, { message: detailsRes.message, data: detailsRes.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_MESSAGES.ROLE_DETAILS_FAILED, statusCode: 500 });
    }
};


const getUserDetail = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const { companyId, roleCode } = req.query;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!userId || !UUID_REGEX.test(userId)) {
            return HttpResponse.error(res, { message: USER_LIMIT_CONFIG_MESSAGES.INVALID_USER_ID, statusCode: 400 });
        }
        if (!companyId || !isValidUUID(companyId)) {
            return HttpResponse.error(res, { message: ADMIN_USER_DETAIL_MESSAGES.COMPANY_ID_REQUIRED, statusCode: 400 });
        }
        if (!roleCode) {
            return HttpResponse.error(res, { message: ADMIN_USER_DETAIL_MESSAGES.ROLE_CODE_REQUIRED, statusCode: 400 });
        }

        const result = await adminService.getUserDetail({ userId, companyId, roleCode });
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_USER_DETAIL_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const getUserKycDocs = async (req, res, next) => {
    try {
        const kycDocsRes = await userService.getUserKycDocs();
        if (!kycDocsRes.success) {
            return HttpResponse.error(res, { message: kycDocsRes.message, statusCode: kycDocsRes.statusCode });
        }
        return HttpResponse.success(res, { message: kycDocsRes.message, data: kycDocsRes.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: KYC_MESSAGES.KYC_LISTING_FAILED, statusCode: 500 });
    }
};

const kycDocumentAction = async (req, res, next) => {
    try {
        const adminId = req.adminId;
        const { kyc_id, action } = req.body;

        if (!kyc_id || !action) {
            return HttpResponse.error(res, { message: 'kyc_id and action are required', statusCode: 400 });
        }

        if (!['approve', 'reject'].includes(action)) {
            return HttpResponse.error(res, { message: 'action must be approve or reject', statusCode: 400 });
        }

        const result = await kycService.updateDocumentStatus({ kycInfoId: kyc_id, action, adminId });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: KYC_MESSAGES.DOCUMENT_ACTION_FAILED, statusCode: 500 });
    }
};

const kycReviewAction = async (req, res, next) => {
    try {
        const adminId = req.adminId;
        const { company_id, action, rejection_reason } = req.body;

        if (!company_id || !action) {
            return HttpResponse.error(res, { message: 'company_id and action are required', statusCode: 400 });
        }

        if (!['approve', 'reject'].includes(action)) {
            return HttpResponse.error(res, { message: 'action must be approve or reject', statusCode: 400 });
        }

        if (action === 'reject' && !rejection_reason) {
            return HttpResponse.error(res, { message: 'rejection_reason is required when rejecting', statusCode: 400 });
        }

        const result = await kycService.updateReviewStatus({
            companyId: company_id,
            action,
            rejectionReason: rejection_reason,
            adminId
        });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: KYC_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 500 });
    }
};

const getUserLimitConfig = async (req, res, next) => {
    try {
        const { userType } = req;
        const userId = req.params.userId;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!userId || !UUID_REGEX.test(userId)) {
            return HttpResponse.error(res, {
                message: USER_LIMIT_CONFIG_MESSAGES.INVALID_USER_ID,
                statusCode: 400
            });
        }

        const serviceResponse = await adminService.getUserLimitConfig({ userId, userType });

        if (!serviceResponse.success) {
            return HttpResponse.error(res, {
                message: serviceResponse.message,
                data: serviceResponse.data,
                statusCode: serviceResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: serviceResponse.message,
            data: serviceResponse.data,
            statusCode: serviceResponse.statusCode
        });

    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: USER_LIMIT_CONFIG_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * POST /api/v1/admin/auth/logout
 * Revokes the current admin session (if SESSION_LIMIT_ENABLED) then clears cookies.
 * req.adminId and req.jti are set by adminMiddleware.
 */
const logout = async (req, res, next) => {
    try {
        if (SESSION_LIMIT_ENABLED && req.jti && req.adminId) {
            const logoutResult = await adminSessionService.logoutCurrentSession(req.adminId, req.jti);
            if (!logoutResult.success) {
                // Log but don't fail — cookies must always be cleared
                errorLogger.error('[adminController.logout] Session revocation failed:', logoutResult.message);
            }
        }

        res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, clearCookieOptions());
        res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, clearCookieOptions());

        return HttpResponse.success(res, { message: SESSION_MESSAGES.LOGOUT_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: SESSION_MESSAGES.LOGOUT_FAILED, statusCode: 500 });
    }
};

const updateUserLimitConfig = async (req, res, next) => {
    try {
        const { userType, adminId } = req;
        const userId = req.params.userId;
        const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!userId || !UUID_REGEX.test(userId)) {
            return HttpResponse.error(res, {
                message: USER_LIMIT_CONFIG_MESSAGES.INVALID_USER_ID,
                statusCode: 400
            });
        }

        const { error: validationError, value: payload } = updateLimitConfigSchema.validate(req.body, {
            abortEarly: false
        });

        if (validationError) {
            return HttpResponse.error(res, {
                message: validationError.details.map(d => d.message).join(', '),
                statusCode: 400
            });
        }

        const serviceResponse = await adminService.updateUserLimitConfig({
            userId,
            adminId,
            userType,
            payload
        });

        if (!serviceResponse.success) {
            return HttpResponse.error(res, {
                message: serviceResponse.message,
                data: serviceResponse.data,
                statusCode: serviceResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: serviceResponse.message,
            data: serviceResponse.data,
            statusCode: serviceResponse.statusCode
        });

    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: USER_LIMIT_CONFIG_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

const updateUserSuspension = async (req, res, next) => {
    try {
        const adminId = req.adminId;
        const role = req.role;
        const { userId, companyId, isSuspended, suspensionReason } = req.body;

        if (!userId) {
            return HttpResponse.error(res, { message: USER_SUSPENSION_MESSAGES.USER_ID_REQUIRED, statusCode: 400 });
        }

        if (typeof isSuspended !== 'boolean') {
            return HttpResponse.error(res, { message: USER_SUSPENSION_MESSAGES.IS_SUSPENDED_REQUIRED, statusCode: 400 });
        }

        if (isSuspended && !suspensionReason) {
            return HttpResponse.error(res, { message: USER_SUSPENSION_MESSAGES.SUSPENSION_REASON_REQUIRED, statusCode: 400 });
        }

        const result = await adminService.updateUserSuspension(
            userId,
            companyId,
            adminId,
            role,
            isSuspended,
            suspensionReason
        );

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: USER_SUSPENSION_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

const updateRoleSwitchStatus = async (req, res, next) => {
    try {
        const adminId = req.adminId;
        const { companyUserRoleId, action, rejectionReason } = req.body;

        if (!companyUserRoleId) {
            return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.COMPANY_USER_ROLE_ID_REQUIRED, statusCode: 400 });
        }

        if (!action) {
            return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.ACTION_REQUIRED, statusCode: 400 });
        }

        if (!['approve', 'reject'].includes(action)) {
            return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.INVALID_ACTION, statusCode: 400 });
        }

        if (action === 'reject' && !rejectionReason) {
            return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.REJECTION_REASON_REQUIRED, statusCode: 400 });
        }

        const result = await adminService.updateRoleSwitchStatus({ companyUserRoleId, action, rejectionReason, adminId });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ROLE_SWITCH_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 500 });
    }
};

const getMatchingEngineStats = async (req, res, next) => {
    try {
        const result = await adminService.getMatchingEngineStats();
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }
        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: result.statusCode });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: 'Error fetching matching engine stats.', statusCode: 500 });
    }
};

// ── Admin Self-Service Profile Controllers ────────────────────────────────────

/**
 * GET /api/v1/admin/profile
 *
 * Returns the signed-in admin's own profile as a structured field list.
 * No authorize() needed — personal data, adminMiddleware JWT check is sufficient.
 * req.adminId is set by adminMiddleware.
 */
const getAdminProfile = async (req, res, next) => {
    try {
        const adminId = req.adminId;

        const result = await adminService.getAdminProfile(adminId);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_PROFILE_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * PUT /api/v1/admin/profile
 *
 * Updates the signed-in admin's own editable profile fields (name, country_code,
 * mobile_number). Email and role are not updatable here.
 * No authorize() needed — personal data, adminMiddleware JWT check is sufficient.
 * req.adminId is set by adminMiddleware.
 */
const updateAdminProfile = async (req, res, next) => {
    try {
        const adminId = req.adminId;

        const { error: validationError, value: payload } = updateAdminProfileSchema.validate(req.body, {
            abortEarly: false
        });

        if (validationError) {
            return HttpResponse.error(res, {
                message: validationError.details.map(d => d.message).join(', '),
                statusCode: 400
            });
        }

        const result = await adminService.updateAdminProfile(adminId, payload);
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: ADMIN_PROFILE_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = {
    login,
    triggerOtp,
    verifyMfaOtp,
    resendMfaOtp,
    getUserList,
    getUserDetail,
    getUserKycDocs,
    kycDocumentAction,
    kycReviewAction,
    getUserLimitConfig,
    updateUserLimitConfig,
    updateUserSuspension,
    updateRoleSwitchStatus,
    getMatchingEngineStats,
    logout,
    getAdminProfile,
    updateAdminProfile,
    getSwitchedRoleUsers,
    getRoleSwitchUserDetails
};
