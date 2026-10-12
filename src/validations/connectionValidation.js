'use strict';

const Joi = require('joi');
const HttpResponse = require('../utils/HttpResponse');

const sendConnectionRequestSchema = Joi.object({
    recipientUserId: Joi.string().guid({ version: 'uuidv4' }).required().messages({
        'string.base': 'recipientUserId must be a string',
        'string.guid': 'recipientUserId must be a valid UUID',
        'any.required': 'recipientUserId is required'
    }),
    recipientRoleId: Joi.number().integer().positive().required().messages({
        'number.base': 'recipientRoleId must be a number',
        'number.integer': 'recipientRoleId must be an integer',
        'number.positive': 'recipientRoleId must be a positive number',
        'any.required': 'recipientRoleId is required'
    }),
    recipientCompanyId: Joi.string().guid({ version: 'uuidv4' }).required().messages({
        'string.base': 'recipientCompanyId must be a string',
        'string.guid': 'recipientCompanyId must be a valid UUID',
        'any.required': 'recipientCompanyId is required'
    }),
    personalMessage: Joi.string().max(500).optional().allow(null, '').messages({
        'string.max': 'personalMessage must not exceed 500 characters'
    }),
    bussinessIntent: Joi.array().items(Joi.string()).optional().allow(null).messages({
        'array.base': 'bussinessIntent must be an array of strings'
    }),
    expectedDealSize: Joi.string().max(255).optional().allow(null, '').messages({
        'string.max': 'expectedDealSize must not exceed 255 characters'
    }),
    productServiceDetails: Joi.string().max(500).optional().allow(null, '').messages({
        'string.max': 'productServiceDetails must not exceed 500 characters'
    })
});

const validate = (schema) => (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        const messages = error.details.map((d) => d.message);
        return HttpResponse.error(res, { message: messages, statusCode: 400 });
    }
    next();
};

const changeStatusSchema = Joi.object({
    connectionId: Joi.number().integer().positive().required().messages({
        'number.base': 'connectionId must be a number',
        'number.integer': 'connectionId must be an integer',
        'number.positive': 'connectionId must be a positive number',
        'any.required': 'connectionId is required'
    }),
    status: Joi.string().valid('Viewed', 'Accepted', 'Declined', 'Deferred', 'Withdrawn').required().messages({
        'any.only': 'status must be one of: Viewed, Accepted, Declined, Deferred, Withdrawn',
        'any.required': 'status is required'
    }),
    reason: Joi.string().max(500).optional().allow(null, '').messages({
        'string.max': 'message must not exceed 500 characters'
    })
});

module.exports = { sendConnectionRequestSchema, changeStatusSchema, validate };
