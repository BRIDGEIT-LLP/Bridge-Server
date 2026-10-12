'use strict';

// Offer form validation, shared by Save-as-Draft, Send Offer and Counter Offer —
// per the spec, all mandatory fields must already be valid before either action.
// Called directly from dealRoomOfferService (payloads arrive over sockets, not
// HTTP, so this is not an Express middleware).

const Joi = require('joi');

const { OFFER_CURRENCY, VALUATION_TYPE } = require('../utils/constant');

const offerPayloadSchema = Joi.object({
    dealRoomId: Joi.string().guid().required(),
    offerId: Joi.number().integer().optional(),
    currency: Joi.string().valid(...Object.values(OFFER_CURRENCY)).required().messages({
        'any.only': `currency must be one of ${Object.values(OFFER_CURRENCY).join(', ')}`
    }),
    investmentAmount: Joi.number().positive().required().messages({
        'number.positive': 'investmentAmount must be a positive number'
    }),
    equityPercentage: Joi.number().greater(0).less(100).required().messages({
        'number.greater': 'equityPercentage must be strictly greater than 0',
        'number.less': 'equityPercentage must be strictly less than 100'
    }),
    valuationType: Joi.string().valid(...Object.values(VALUATION_TYPE)).required().messages({
        'any.only': `valuationType must be one of ${Object.values(VALUATION_TYPE).join(', ')}`
    }),
    validUntil: Joi.date().greater('now').required().messages({
        'date.greater': 'validUntil must be a future date'
    }),
    termsConditions: Joi.string().optional().allow(null, ''),
    supportingNotes: Joi.string().max(500).optional().allow(null, '').messages({
        'string.max': 'supportingNotes must not exceed 500 characters'
    })
});

const validateOfferPayload = (payload) => {
    return offerPayloadSchema.validate(payload, { abortEarly: false });
};

module.exports = { offerPayloadSchema, validateOfferPayload };
