// 'use strict';
const Joi = require('joi');
const { OTP_MESSAGES, GST_MESSAGES, CIN_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { DIAL_CODE_PATTERN, NATIONAL_NUMBER_PATTERN } = require('../utils/phoneValidation');
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CIN_PATTERN = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

const companyRegistrationSchema = Joi.object({
    companyName: Joi.string().min(3).max(100).required().messages({
        'string.min': 'companyName must be at least 3 characters long',
        'string.max': 'companyName must not exceed 100 characters',
        'any.required': 'companyName is required'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    countryCode: Joi.string().pattern(DIAL_CODE_PATTERN).required().messages({
        'string.pattern.base': 'countryCode must be a dial code like +91 or +1',
        'any.required': 'countryCode is required'
    }),
    phoneNumber: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).required().messages({
        'string.pattern.base': 'phoneNumber must be a valid national number for the selected country',
        'any.required': 'phoneNumber is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.min': 'password must be at least 8 characters long',
        'string.pattern.base': 'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'password is required'
    }),
    role: Joi.string().valid('INVESTOR', 'B2B', 'STARTUP').required().messages({
        'any.only': 'role must be one of: INVESTOR, B2B, STARTUP',
        'any.required': 'role is required'
    }),
    termsAccepted: Joi.boolean().valid(true).required().messages({
        'any.only': 'termsAccepted must be true',
        'any.required': 'termsAccepted is required'
    }),
    gstNumber: Joi.string().pattern(GSTIN_PATTERN).when('role', {
        is: 'B2B',
        then: Joi.required().messages({
            'any.required': 'gstNumber is required for B2B role',
            'string.pattern.base': GST_MESSAGES.INVALID_FORMAT
        }),
        otherwise: Joi.optional().allow(null, '').messages({
            'string.pattern.base': GST_MESSAGES.INVALID_FORMAT
        })
    }),
    cinNumber: Joi.string().pattern(CIN_PATTERN).when('role', {
        is: 'B2B',
        then: Joi.required().messages({
            'any.required': 'cinNumber is required for B2B role',
            'string.pattern.base': CIN_MESSAGES.INVALID_FORMAT
        }),
        otherwise: Joi.optional().allow(null, '').messages({
            'string.pattern.base': CIN_MESSAGES.INVALID_FORMAT
        })
    })
});

const verifyGstSchema = Joi.object({
    gstin: Joi.string().pattern(GSTIN_PATTERN).required().messages({
        'string.pattern.base': GST_MESSAGES.INVALID_FORMAT,
        'any.required': 'gstin is required'
    })
});

const verifyCinSchema = Joi.object({
    cin: Joi.string().pattern(CIN_PATTERN).required().messages({
        'string.pattern.base': CIN_MESSAGES.INVALID_FORMAT,
        'any.required': 'cin is required'
    })
});

const verifyOtpSchema = Joi.object({
    channel: Joi.string().valid('EMAIL', 'PHONE').required().messages({
        'any.only': 'channel must be EMAIL or PHONE',
        'any.required': 'channel is required'
    }),
    otp: Joi.string().length(4).pattern(/^\d+$/).required().messages({
        'string.length': 'otp must be exactly 4 characters',
        'string.pattern.base': 'otp must contain only digits',
        'any.required': 'otp is required'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).when('channel', {
        is: 'EMAIL',
        then: Joi.required().messages({ 'any.required': OTP_MESSAGES.EMAIL_VALIDATION_FAILED }),
        otherwise: Joi.optional().allow(null, '')
    }),
    phoneNumber: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).when('channel', {
        is: 'PHONE',
        then: Joi.required().messages({ 'any.required': OTP_MESSAGES.PHONE_NUMBER_VALIDATION_FAILED }),
        otherwise: Joi.optional().allow(null, '')
    })
});

const resendOtpSchema = Joi.object({
    channel: Joi.string().valid('EMAIL', 'PHONE').required().messages({
        'any.only': 'channel must be EMAIL or PHONE',
        'any.required': 'channel is required'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).when('channel', {
        is: 'EMAIL',
        then: Joi.required().messages({ 'any.required': 'email is required when channel is EMAIL' }),
        otherwise: Joi.optional().allow(null, '')
    }),
    phoneNumber: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).when('channel', {
        is: 'PHONE',
        then: Joi.required().messages({ 'any.required': 'phoneNumber is required when channel is PHONE' }),
        otherwise: Joi.optional().allow(null, '')
    })
});

const refreshTokenSchema = Joi.object({
    refreshToken: Joi.string().required().messages({
        'any.required': 'refreshToken is required'
    })
});

const loginSchema = Joi.object({
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.min': 'password must be at least 8 characters long',
        'string.pattern.base': 'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'password is required'
    })
});

/**
 * Higher-order middleware to run Joi validation against `req.body` (default)
 * or another request property such as `query`.
 */
const validate = (schema, source = 'body') => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req[source], { abortEarly: false });
        if (error) {
            const errors = error.details.map(err => ({
                field: err.path.join('.'),
                message: err.message.replace(/['"]/g, '')
            }));
            return HttpResponse.error(res, {
                message: 'Validation failed',
                data: errors,
                statusCode: 400
            });
        }
        req[source] = value;
        next();
    };
};

const switchRoleSchema = Joi.object({
    roleCode: Joi.string().valid('INVESTOR', 'B2B', 'STARTUP').required().messages({
        'any.only': 'roleCode must be one of: INVESTOR, B2B, STARTUP',
        'any.required': 'roleCode is required'
    })
});

// Same roleCode rule as switch-role, but the rest of the body is the target
// role's profile fields (user/company columns) collected on the switch form.
const requestRoleSwitchSchema = switchRoleSchema.unknown(true);

const resetPasswordSchema = Joi.object({
    newPassword: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.min': 'newPassword must be at least 8 characters long',
        'string.pattern.base': 'newPassword must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'newPassword is required'
    })
});

module.exports = {
    validate,
    companyRegistrationSchema,
    verifyGstSchema,
    verifyCinSchema,
    verifyOtpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    loginSchema,
    resetPasswordSchema,
    switchRoleSchema,
    requestRoleSwitchSchema
};
