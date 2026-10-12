'use strict';
const { CompanyRoleMaster } = require('../models');
const userRepository = require('../repositories/userRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { ROLE_FIELD_METADATA_MESSAGES, USER_MESSAGES } = require('../utils/constant');


const validateUserPayload = async (role, payload) => {
    try {
        const roleObj = await CompanyRoleMaster.findOne({
            where: { role_code: role.toUpperCase(), is_deleted: false }
        });
        if (!roleObj) {
            return ServiceResponse.error({ message: ROLE_FIELD_METADATA_MESSAGES.FETCH_FAILED, statusCode: 400 });
        }

        const roleMetadata = await userRepository.getUserProfileFieldsConfig(roleObj.id);
        const userTableMetadata = roleMetadata
            .map((f) => (typeof f.get === 'function' ? f.get({ plain: true }) : f))
            .filter((f) => f.source_table === 'user' && f.is_registration_field === true);

        const errors = [];

        for (const meta of userTableMetadata) {
            const {
                datatype, type, is_required,
                min_length, max_length, min_value, max_value,
                regex_pattern, allowed_values, display_name
            } = meta;
            const lookup = meta.lookup || meta.field_name;
            const kind = datatype || type;

            const value = payload[lookup];
            const isEmpty = value === undefined || value === null || value === ''
                || (Array.isArray(value) && value.length === 0);

            if (is_required && isEmpty) {
                errors.push({ field: lookup, message: `${display_name} is required` });
                continue;
            }

            if (isEmpty) continue;

            switch (kind) {
                case 'string': {
                    if (typeof value !== 'string') {
                        errors.push({ field: lookup, message: `${display_name} must be a string` });
                        break;
                    }
                    if (min_length != null && value.length < min_length)
                        errors.push({ field: lookup, message: `${display_name} must be at least ${min_length} characters` });
                    if (max_length != null && value.length > max_length)
                        errors.push({ field: lookup, message: `${display_name} must not exceed ${max_length} characters` });
                    if (regex_pattern && !new RegExp(regex_pattern).test(value))
                        errors.push({ field: lookup, message: `${display_name} format is invalid` });
                    break;
                }
                case 'integer': {
                    const intVal = Number(value);
                    if (!Number.isInteger(intVal)) {
                        errors.push({ field: lookup, message: `${display_name} must be an integer` });
                        break;
                    }
                    if (min_value != null && intVal < Number(min_value))
                        errors.push({ field: lookup, message: `${display_name} must be at least ${min_value}` });
                    if (max_value != null && intVal > Number(max_value))
                        errors.push({ field: lookup, message: `${display_name} must not exceed ${max_value}` });
                    break;
                }
                case 'decimal': {
                    const decVal = parseFloat(value);
                    if (isNaN(decVal)) {
                        errors.push({ field: lookup, message: `${display_name} must be a number` });
                        break;
                    }
                    if (min_value != null && decVal < Number(min_value))
                        errors.push({ field: lookup, message: `${display_name} must be at least ${min_value}` });
                    if (max_value != null && decVal > Number(max_value))
                        errors.push({ field: lookup, message: `${display_name} must not exceed ${max_value}` });
                    break;
                }
                case 'boolean':
                    if (typeof value !== 'boolean' && value !== 'true' && value !== 'false')
                        errors.push({ field: lookup, message: `${display_name} must be a boolean` });
                    break;
                case 'date':
                case 'datetime':
                    if (isNaN(Date.parse(value)))
                        errors.push({ field: lookup, message: `${display_name} must be a valid ${datatype}` });
                    break;
                case 'json':
                    if (typeof value !== 'object' || Array.isArray(value))
                        errors.push({ field: lookup, message: `${display_name} must be a valid JSON object` });
                    break;
                case 'file':
                    // file upload validation is handled at the multipart layer
                    break;
                case 'array': {
                    if (!Array.isArray(value))
                        errors.push({ field: lookup, message: `${display_name} must be an array` });
                    break;
                }
            }

            if (Array.isArray(allowed_values) && allowed_values.length > 0 && !Array.isArray(value)
                && !allowed_values.includes(value)) {
                errors.push({ field: lookup, message: `${display_name} must be one of: ${allowed_values.join(', ')}` });
            }
        }

        if (errors.length > 0) {
            return ServiceResponse.error({ message: USER_MESSAGES.VALIDATION_FAILED, data: errors, statusCode: 400 });
        }
        return ServiceResponse.success();
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: ROLE_FIELD_METADATA_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};


module.exports = {
    validateUserPayload
};
