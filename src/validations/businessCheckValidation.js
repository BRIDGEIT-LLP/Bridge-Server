'use strict';
const Joi = require('joi');
const { GST_MESSAGES, CIN_MESSAGES, BUSINESS_CHECK_MESSAGES } = require('../utils/constant');

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CIN_PATTERN = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

// Which identifiers are asked depends on the role (enforced in businessCheckService);
// the schema only checks the shape of whatever was sent.
const businessCheckSchema = Joi.object({
    gst_number: Joi.string().trim().uppercase().pattern(GSTIN_PATTERN).allow('', null).messages({
        'string.pattern.base': GST_MESSAGES.INVALID_FORMAT
    }),
    cin_number: Joi.string().trim().uppercase().pattern(CIN_PATTERN).allow('', null).messages({
        'string.pattern.base': CIN_MESSAGES.INVALID_FORMAT
    }),
    pan_number: Joi.string().trim().uppercase().pattern(PAN_PATTERN).allow('', null).messages({
        'string.pattern.base': BUSINESS_CHECK_MESSAGES.INVALID_PAN
    })
});

module.exports = { businessCheckSchema, PAN_PATTERN, CIN_PATTERN, GSTIN_PATTERN };
