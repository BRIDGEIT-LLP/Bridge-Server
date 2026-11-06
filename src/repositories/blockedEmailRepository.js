'use strict';
const { BlockedEmail } = require('../models');

// "Active block" = is_deleted = false. Every read goes through here so that the
// definition lives in one place (an unblock is a soft-delete of this row).
const findActiveByEmail = async (email, { transaction } = {}) => {
    return await BlockedEmail.findOne({
        where: { email, is_deleted: false },
        transaction
    });
};

// Idempotent: a concurrent request that loses the unique-index race gets the
// existing active row back instead of an error.
const createIfNotActive = async (data, { transaction } = {}) => {
    const [row] = await BlockedEmail.findOrCreate({
        where: { email: data.email, is_deleted: false },
        defaults: data,
        transaction
    });
    return row;
};

module.exports = { findActiveByEmail, createIfNotActive };
