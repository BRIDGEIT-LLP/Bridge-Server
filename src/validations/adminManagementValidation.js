'use strict';
const Joi = require('joi');
const HttpResponse = require('../utils/HttpResponse');
const { ADMIN_PERMISSION_KEYS } = require('../utils/constant');
const { NATIONAL_NUMBER_PATTERN } = require('../utils/phoneValidation');

const VALID_PERMISSION_KEYS = Object.values(ADMIN_PERMISSION_KEYS);

const permissionItemSchema = Joi.object({
    permission_key: Joi.string().valid(...VALID_PERMISSION_KEYS).required().messages({
        'any.only': `permission_key must be one of: ${VALID_PERMISSION_KEYS.join(', ')}`,
        'any.required': 'permission_key is required'
    }),
    is_allowed: Joi.boolean().required().messages({
        'boolean.base': 'is_allowed must be a boolean',
        'any.required': 'is_allowed is required'
    })
});

const createAdminSchema = Joi.object({
    name: Joi.string().min(2).max(100).required().messages({
        'string.min': 'name must be at least 2 characters long',
        'string.max': 'name must not exceed 100 characters',
        'any.required': 'name is required'
    }),
    email: Joi.string().email({ tlds: { allow: false } }).required().messages({
        'string.email': 'email must be a valid email address',
        'any.required': 'email is required'
    }),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
        'string.min': 'password must be at least 8 characters long',
        'string.pattern.base': 'password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
        'any.required': 'password is required'
    }),
    country_code: Joi.string().max(5).optional().allow(null, '').messages({
        'string.max': 'country_code must not exceed 5 characters'
    }),
    mobile_number: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).optional().allow(null, '').messages({
        'string.pattern.base': 'mobile_number must be a valid national number for the selected country'
    }),
    role: Joi.string().valid('ADMIN').required().messages({
        'any.only': 'role must be ADMIN',
        'any.required': 'role is required'
    }),
    permissions: Joi.array()
        .items(permissionItemSchema)
        .unique('permission_key')
        .optional()
        .messages({
            'array.base': 'permissions must be an array',
            'array.unique': 'permissions contains duplicate permission_key: {#dupeValue.permission_key}'
        })
});

const updateAdminSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional().messages({
        'string.min': 'name must be at least 2 characters long',
        'string.max': 'name must not exceed 100 characters'
    }),
    country_code: Joi.string().max(5).optional().allow(null, '').messages({
        'string.max': 'country_code must not exceed 5 characters'
    }),
    mobile_number: Joi.string().pattern(NATIONAL_NUMBER_PATTERN).optional().allow(null, '').messages({
        'string.pattern.base': 'mobile_number must be a valid national number for the selected country'
    }),
    permissions: Joi.array()
        .items(permissionItemSchema)
        .unique('permission_key')
        .optional()
        .messages({
            'array.base': 'permissions must be an array',
            'array.unique': 'permissions contains duplicate permission_key: {#dupeValue.permission_key}'
        })
}).or('name', 'country_code', 'mobile_number', 'permissions').messages({
    'object.missing': 'At least one field must be provided for update'
});

const adminActionSchema = Joi.object({
    reason: Joi.string().min(5).max(500).required().messages({
        'string.min': 'reason must be at least 5 characters long',
        'string.max': 'reason must not exceed 500 characters',
        'any.required': 'reason is required'
    })
});

/**
 * Higher-order middleware to run Joi validation — mirrors authValidation.validate().
 */
const validate = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body, { abortEarly: false });
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
        next();
    };
};

module.exports = {
    validate,
    createAdminSchema,
    updateAdminSchema,
    adminActionSchema
};
