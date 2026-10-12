'use strict';

const Joi = require('joi');
const HttpResponse = require('../utils/HttpResponse');

const sendMediaMessageSchema = Joi.object({
    caption: Joi.string().max(500).optional().allow(null, '').messages({
        'string.max': 'caption must not exceed 500 characters'
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

module.exports = { sendMediaMessageSchema, validate };
