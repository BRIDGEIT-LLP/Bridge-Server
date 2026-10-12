'use strict';

// Term sheet edit payload validation. Called directly from dealRoomTermSheetService
// (payloads arrive over sockets, not HTTP, so this is not an Express middleware) —
// same reasoning as dealRoomOfferValidation.

const Joi = require('joi');

const { OFFER_CURRENCY } = require('../utils/constant');

const termSheetPayloadSchema = Joi.object({
    dealRoomId: Joi.string().guid().required(),
    moqQuantity: Joi.number().positive().required().messages({
        'number.positive': 'moqQuantity must be a positive number'
    }),
    moqUnit: Joi.string().trim().min(1).max(50).required(),
    unitPrice: Joi.number().positive().required().messages({
        'number.positive': 'unitPrice must be a positive number'
    }),
    currency: Joi.string().valid(...Object.values(OFFER_CURRENCY)).required().messages({
        'any.only': `currency must be one of ${Object.values(OFFER_CURRENCY).join(', ')}`
    }),
    paymentTerms: Joi.string().trim().min(1).required(),
    supplyLogisticsTerms: Joi.string().trim().min(1).required()
});

const validateTermSheetPayload = (payload) => {
    return termSheetPayloadSchema.validate(payload, { abortEarly: false });
};

module.exports = { termSheetPayloadSchema, validateTermSheetPayload };
