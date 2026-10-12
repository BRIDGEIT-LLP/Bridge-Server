'use strict';

const Joi = require('joi');
const HttpResponse = require('../utils/HttpResponse');

const updateTrialConfigSchema = Joi.object({
    trialConfig: Joi.object({
        free_trial_day: Joi.number().integer().min(0).max(365).messages({
            'number.base': 'free_trial_day must be a number',
            'number.integer': 'free_trial_day must be an integer',
            'number.min': 'free_trial_day must be at least 0',
            'number.max': 'free_trial_day must not exceed 365'
        }),
        free_trial_connection_limit: Joi.number().integer().min(0).max(1000).messages({
            'number.base': 'free_trial_connection_limit must be a number',
            'number.integer': 'free_trial_connection_limit must be an integer',
            'number.min': 'free_trial_connection_limit must be at least 0',
            'number.max': 'free_trial_connection_limit must not exceed 1000'
        }),
        premium_connection_limit: Joi.number().integer().min(0).max(1000).messages({
            'number.base': 'premium_connection_limit must be a number',
            'number.integer': 'premium_connection_limit must be an integer',
            'number.min': 'premium_connection_limit must be at least 0',
            'number.max': 'premium_connection_limit must not exceed 1000'
        }),
        manual_extension: Joi.boolean().messages({
            'boolean.base': 'manual_extension must be a boolean'
        }),
        auto_downgrade: Joi.boolean().messages({
            'boolean.base': 'auto_downgrade must be a boolean'
        }),
        expiry_notification: Joi.boolean().messages({
            'boolean.base': 'expiry_notification must be a boolean'
        }),
        aws_service_enabled: Joi.boolean().messages({
            'boolean.base': 'aws_service_enabled must be a boolean'
        })
    }).min(1).required().messages({
        'object.base': 'trialConfig must be an object',
        'object.min': 'trialConfig must contain at least one configuration key',
        'object.unknown': '{#label} is not a valid trial configuration key',
        'any.required': 'trialConfig is required'
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

module.exports = { updateTrialConfigSchema, validate };
