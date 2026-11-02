'use strict';
const bcrypt = require('bcrypt');
const { DATA_TYPES } = require('./constant');

// Generates a random 4-digit OTP
const generateOTP = () => {
    return Math.floor(1000 + Math.random() * 9000).toString();
};

// Hash password using bcrypt
const hashPassword = async (password) => {
    const saltRounds = process.env.HASH_SALT_ROUNDS || 10;
    return await bcrypt.hash(password, Number(saltRounds));
};

// watermark data
const waterMarkFunction = (company_id, user_id) => {
    const date = new Date().toISOString().split('T')[0]
    return `Bridge |${company_id} | ${user_id} | ${date}`
}

const maskPhone = (phone) => {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "(+91 ••• ••• 4493)";
  return `••• ••• ${digits.slice(-4)}`;
}
 
const maskEmail = (email) => {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "(j•••@company.com)";
  if (local.length <= 5) return `${local}@${domain}`;
  const hidden = local.length - 5; // 1 first char + 4 last chars revealed
  return `${local[0]}${".".repeat(hidden)}${local.slice(-4)}@${domain}`;
}

// Canonical form of an email for the blocked_email table: trimmed, lower-cased,
// and Gmail aliases collapsed (dots ignored, +suffix dropped, googlemail.com ==
// gmail.com) so a blocked address cannot be bypassed by re-typing it.
const normalizeEmail = (email) => {
    if (typeof email !== 'string') return '';
    const trimmed = email.trim().toLowerCase();
    const at = trimmed.lastIndexOf('@');
    if (at < 1) return trimmed;

    let local = trimmed.slice(0, at);
    let domain = trimmed.slice(at + 1);

    if (domain === 'gmail.com' || domain === 'googlemail.com') {
        domain = 'gmail.com';
        local = local.split('+')[0].replace(/\./g, '');
    }
    return `${local}@${domain}`;
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUUID = (uuid) => {
  return UUID_REGEX.test(uuid);
}

function formatValue(value, dataType, unit) {
    if (value === null || value === undefined) {
        return value;
    }

    switch (dataType) {
        case DATA_TYPES.STRING:
            return String(value);

        case DATA_TYPES.INTEGER: {
            const intValue = parseInt(value, 10);

            if (Number.isNaN(intValue)) {
                throw new Error(`Invalid integer value: ${value}`);
            }

            return intValue;
        }

        case DATA_TYPES.FLOAT: {
            const floatValue = parseFloat(value);

            if (Number.isNaN(floatValue)) {
                throw new Error(`Invalid float value: ${value}`);
            }

            return floatValue;
        }

        case DATA_TYPES.BOOLEAN:
            if (typeof value === 'boolean') {
                return value;
            }

            return ['true', '1', 'yes'].includes(
                String(value).toLowerCase()
            );

        case DATA_TYPES.DATE:
        case DATA_TYPES.DATETIME: {
            const date = new Date(value);

            if (Number.isNaN(date.getTime())) {
                throw new Error(`Invalid date value: ${value}`);
            }

            return date;
        }

        default:
            return value;
    }
}

module.exports = {
    generateOTP,
    hashPassword,
    waterMarkFunction,
    maskPhone,
    maskEmail,
    normalizeEmail,
    isValidUUID,
    formatValue
};
