'use strict';
const blockedEmailRepository = require('../repositories/blockedEmailRepository');
const userSessionRepository = require('../repositories/userSessionRepository');
const sessionCacheRepository = require('../repositories/sessionCacheRepository');
const adminConfigService = require('./adminConfigService');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const {
    EMAIL_BLOCK_MESSAGES, KYC_REJECTION_LIMITS, TRIAL_CONFIG_LOOKUP_KEYS, KYC_STATUS
} = require('../utils/constant');

/**
 * All blocked-email state changes live here. Callers only ever use
 * checkEmail / applyBlock; a later unblock feature adds releaseBlock beside
 * them without touching any caller.
 *
 * Blocking is deliberately independent of the user-suspension feature: it never
 * touches is_user_suspended / user_suspension_history, so blocked emails do not
 * appear in (or get mixed with) the suspended-users list.
 */

/**
 * Configured number of final KYC rejections that triggers a block. Falls back to
 * the default when the config row is missing or malformed — never "no limit".
 */
const getRejectionLimit = async () => {
    const value = await adminConfigService.getTrialConfigValue(
        TRIAL_CONFIG_LOOKUP_KEYS.KYC_MAX_REJECTIONS,
        KYC_REJECTION_LIMITS.DEFAULT_MAX_REJECTIONS
    );
    const limit = Number(value);
    if (!Number.isInteger(limit) || limit < KYC_REJECTION_LIMITS.MIN) {
        return KYC_REJECTION_LIMITS.DEFAULT_MAX_REJECTIONS;
    }
    return limit;
};

/**
 * Is this email blocked? Reads the DB directly (callers are low-frequency,
 * pre-authentication endpoints). Fails CLOSED: if the lookup errors, the caller
 * gets a 503 and must not let the request through.
 */
const checkEmail = async (email, { transaction } = {}) => {
    try {
        const block = await blockedEmailRepository.findActiveByEmail(email, { transaction });
        return ServiceResponse.success({ data: { blocked: Boolean(block), block } });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: EMAIL_BLOCK_MESSAGES.CHECK_FAILED, statusCode: 503 });
    }
};

/**
 * Blocks an email and ends the user's live sessions. Runs inside the caller's
 * transaction so a failed step rolls the whole rejection back. Throws on error
 * (the caller's transaction handler rolls back). After commit, call
 * invalidateSessionCache(userId).
 */
const applyBlock = async ({ email, companyId, userIds = [], reason, blockedBy, rejectionCount, rejectionLimit }, { transaction }) => {
    const block = await blockedEmailRepository.createIfNotActive({
        email,
        reason,
        company_id: companyId,
        user_id: userIds[0] ?? null,
        rejection_count: rejectionCount,
        rejection_limit: rejectionLimit,
        blocked_at: new Date(),
        blocked_by: blockedBy ?? null,
        created_by: blockedBy ?? null
    }, { transaction });

    // authMiddleware already rejects revoked sessions on every request, which is
    // what stops a user who is signed in right now.
    // Every user on the company, not just the first.
    for (const userId of userIds) {
        await userSessionRepository.revokeAllSessionsByUser(userId, { transaction });
    }
    return block;
};

// Best effort (logs, never throws): drops the cached active-jti set so
// isSessionJtiValid cannot serve a stale VALID for a session just revoked.
const invalidateSessionCache = async (userIds = []) => {
    for (const userId of userIds) {
        await sessionCacheRepository.invalidateUser(userId);
    }
};

/**
 * Warning state shown to the user on every sign-in from their first KYC
 * rejection until KYC is approved. Keyed on the counter, not kyc_status: a
 * resubmission flips kyc_status back to Pending but the count must keep warning.
 * Returns null when there is nothing to warn about.
 */
const buildKycRejectionWarning = async (company) => {
  try {
    const count = company?.kyc_rejection_count ?? 0;
    if (count < 1 || company.kyc_status === KYC_STATUS.APPROVED) {
        return null;
    }

    const maxRejections = await getRejectionLimit();
    const attemptsRemaining = Math.max(maxRejections - count, 0);
    return {
        kycStatus: company.kyc_status,
        kycRejectionCount: count,
        maxRejections,
        attemptsRemaining,
        kycRejectionReason: company.kyc_status === KYC_STATUS.REJECTED ? (company.kyc_rejection_reason ?? null) : null,
        message: EMAIL_BLOCK_MESSAGES.REJECTION_WARNING(attemptsRemaining)
    };
  } catch (error) {
    // A reminder must never fail a sign-in.
    errorLogger.error(error);
    return null;
  }
};

module.exports = { getRejectionLimit, checkEmail, applyBlock, invalidateSessionCache, buildKycRejectionWarning };
