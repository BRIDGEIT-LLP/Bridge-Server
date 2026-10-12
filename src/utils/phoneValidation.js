'use strict';

/**
 * Dial code as stored on company/user (`+` plus 1–4 digits). Matches every
 * entry in the frontend `DIAL_CODES` list (`+1` … `+971`).
 */
const DIAL_CODE_PATTERN = /^\+\d{1,4}$/;

/**
 * National number only (no `+`, no country code). E.164 leaves 6–15 digits
 * after the country code. Country-specific length/prefix rules live on the
 * frontend (`phoneErrorForDialCode`); this is the server-side floor so a
 * US/UAE/UK number isn't rejected as "not a 10-digit Indian mobile".
 */
const NATIONAL_NUMBER_PATTERN = /^\d{6,15}$/;

module.exports = { DIAL_CODE_PATTERN, NATIONAL_NUMBER_PATTERN };
