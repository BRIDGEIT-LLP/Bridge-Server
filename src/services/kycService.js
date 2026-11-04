'use strict';
const { sequelize } = require('../models');
const kycInfoRepository = require('../repositories/kycInfoRepository');
const companyRepository = require('../repositories/companyRepository');
const userLimitConfigRepository = require('../repositories/userLimitConfigRepository');
const adminConfigService = require('./adminConfigService');
const emailBlockService = require('./emailBlockService');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { KYC_MESSAGES, ENCRYPT_DECRYPT_MESSAGES, KYC_STATUS, KYC_DOC_TYPES, TRIAL_CONFIG_LOOKUP_KEYS, USER_LIMIT_DEFAULTS, BLOCK_REASONS, EMAIL_BLOCK_MESSAGES } = require('../utils/constant');
const { decrypt } = require("../utils/encryption");
const userRepository = require('../repositories/userRepository');

const createKycInfo = async (records) => {
    const transaction = await sequelize.transaction();
    try {
        if (!Array.isArray(records) || records.length === 0) {
            return ServiceResponse.error({ message: 'records must be a non-empty array.', statusCode: 400 });
        }

        // Defence in depth: a blocked email must not get new documents into the review
        // queue even if it still holds a token issued before the block.
        const companyIdForBlockCheck = records[0].company_id;
        const companyForBlockCheck = companyIdForBlockCheck
            ? await companyRepository.getCompanyById(companyIdForBlockCheck)
            : null;
        if (companyForBlockCheck) {
            const blockRes = await emailBlockService.checkEmail(companyForBlockCheck.company_email);
            if (!blockRes.success) {
                await transaction.rollback();
                return blockRes;
            }
            if (blockRes.data.blocked) {
                await transaction.rollback();
                return ServiceResponse.error({ message: EMAIL_BLOCK_MESSAGES.BLOCKED, statusCode: 403 });
            }
        }

        const now = new Date();
        const normalized = records.map(r => ({
            ...r,
            status: r.status ?? 'pending',
            created_at: r.created_at ?? now
        }));

        // Upsert per document type: a re-upload after a rejection has to replace the stored
        // document in place, otherwise the user ends up with two rows of the same type and
        // the reviewer sees a duplicate.
        const saved = [];
        for (const record of normalized) {
            const existing = await kycInfoRepository.findKycRecord({
                userId: record.user_id,
                companyId: record.company_id,
                roleId: record.role_id,
                documentType: record.document_type
            }, { transaction });

            if (existing) {
                saved.push(await kycInfoRepository.updateKycRecord(
                    existing.id,
                    { ...record, rejection_reason: null, verified_at: null, verified_by: null },
                    { transaction }
                ));
            } else {
                saved.push(await kycInfoRepository.createKycRecord(record, { transaction }));
            }
        }

        // Clear the company-level rejection so a resubmission goes back into the review
        // queue — without this the user stays on the "Verification Unsuccessful" screen.
        const companyId = normalized[0].company_id;
        const company = await companyRepository.getCompanyById(companyId);
        if (company?.kyc_status === KYC_STATUS.REJECTED) {
            await companyRepository.updateKycStatus(
                companyId,
                { isKycVerified: false, status: KYC_STATUS.PENDING, rejectionReason: null },
                { transaction }
            );
        }

        // Mark the company's KYC as uploaded once every required document type has a
        // stored record — checked against the full set for this user/company/role, not
        // just this call's batch, since the required docs can be submitted across
        // separate requests.
        if (!company?.is_kyc_uploaded) {
            const allRecords = await kycInfoRepository.findAllKycRecords(
                { userId: normalized[0].user_id, companyId, roleId: normalized[0].role_id },
                { transaction }
            );
            const uploadedTypes = new Set(allRecords.map(r => r.document_type));
            const hasAllRequiredDocs = KYC_DOC_TYPES.every(type => uploadedTypes.has(type));
            if (hasAllRequiredDocs) {
                await companyRepository.markKycUploaded(companyId, { transaction });
            }
        }

        await transaction.commit();
        return ServiceResponse.success({
            message: 'KYC documents created successfully.',
            data: { records: saved },
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);

        // The loser of a concurrent double-submit: both requests read "no existing row"
        // and both tried to insert, and the unique index rejected the second. The first
        // one committed, so the user's document is stored — this is a conflict, not a
        // server fault.
        if (error.name === 'SequelizeUniqueConstraintError') {
            return ServiceResponse.error({ message: KYC_MESSAGES.DUPLICATE_SUBMISSION, statusCode: 409 });
        }

        return ServiceResponse.error({ message: 'Failed to create KYC documents.', statusCode: 500 });
    }
};

const getKycInfo = async ({ userId, companyId, roleId }) => {
    try {
        const records = await kycInfoRepository.findAllKycRecordsRaw({ userId, companyId, roleId });

        // The review decision lives on the company, not on kyc_info — a company-level
        // reject never touches the per-document rows. Without this the user has no way
        // to see that they were rejected, or why.
        const company = await companyRepository.getCompanyById(companyId);
        const maxRejections = await emailBlockService.getRejectionLimit();
        const kycRejectionCount = company?.kyc_rejection_count ?? 0;

        return ServiceResponse.success({
            message: KYC_MESSAGES.FETCH_SUCCESS,
            data: {
                records,
                kycStatus: company?.kyc_status ?? null,
                rejectionReason: company?.kyc_rejection_reason ?? null,
                kycRejectionCount,
                maxRejections,
                attemptsRemaining: Math.max(maxRejections - kycRejectionCount, 0)
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const decyptKycInfo = (records) => {
    try {
        let decrypted = [];
        for (const record of records) {
            if (!record.document_number || !record.document_number_iv || !record.document_number_auth_tag) {
                decrypted.push(record);
                continue;
            }
            const { document_number, document_number_iv, document_number_auth_tag } = record;
            const decryptedData = decrypt(document_number, document_number_iv, document_number_auth_tag);
            decrypted.push({ ...record, document_number: decryptedData });
        }
        return serviceResponse.success({ data: decrypted, message: ENCRYPT_DECRYPT_MESSAGES.DECRYPT_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return serviceResponse.error({ message: ENCRYPT_DECRYPT_MESSAGES.DECRYPT_FAILED, statusCode: 500 });
    }
}

const prepareResponse = (decyptedKycInfos) => {
    try {
        let tempResponses = [];
        for (const decyptedKycInfo of decyptedKycInfos) {
            let tempRespons = {}
            tempRespons[decyptedKycInfo.document_type] = {}
            tempRespons[decyptedKycInfo.document_type].number = decyptedKycInfo.document_number
            tempRespons[decyptedKycInfo.document_type].front = {
                s3_key: decyptedKycInfo.front_s3_key,
                file_name: decyptedKycInfo.front_file_name,
                file_size: decyptedKycInfo.front_file_size,
                mimetype: decyptedKycInfo.front_mime_type
            }
            if (decyptedKycInfo.back_s3_key) {
                tempRespons[decyptedKycInfo.document_type].back = {
                    s3_key: decyptedKycInfo.back_s3_key,
                    file_name: decyptedKycInfo.back_file_name,
                    file_size: decyptedKycInfo.back_file_size,
                    mimetype: decyptedKycInfo.back_mime_type
                }
            }
            tempRespons[decyptedKycInfo.document_type].status = decyptedKycInfo.status
            tempRespons[decyptedKycInfo.document_type].rejection_reason = decyptedKycInfo.rejection_reason
            tempRespons[decyptedKycInfo.document_type].verified_at = decyptedKycInfo.verified_at
            tempRespons[decyptedKycInfo.document_type].verified_by = decyptedKycInfo.verified_by
            tempResponses.push(tempRespons)
        }
        return ServiceResponse.success({ data: tempResponses, statusCode: 200 });
    }
    catch (error) {
        errorLogger.error(error);
        return serviceResponse.error();
    }
    
}

const updateDocumentStatus = async ({ kycInfoId, action, adminId }) => {
    try {
        const updated = await kycInfoRepository.updateKycRecord(kycInfoId, {
            status: action === 'approve' ? KYC_STATUS.APPROVED : KYC_STATUS.REJECTED,
            verified_by: adminId,
            verified_at: new Date(),
            updated_by: adminId
        });
        return ServiceResponse.success({ message: KYC_MESSAGES.DOCUMENT_ACTION_SUCCESS, data: updated, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.DOCUMENT_ACTION_FAILED, statusCode: 500 });
    }
};

const updateReviewStatus = async ({ companyId, action, rejectionReason, adminId }) => {
    // Resolved before the transaction opens so config I/O (Redis/DB) is never done
    // while the company row is locked.
    const rejectionLimit = action === 'reject' ? await emailBlockService.getRejectionLimit() : null;

    const transaction = await sequelize.transaction();
    try {
        const status = action === 'approve' ? KYC_STATUS.APPROVED : KYC_STATUS.REJECTED;
        const reason = action === 'reject' ? (rejectionReason ?? null) : null;
        const isKycVerified = status === KYC_STATUS.APPROVED ? true : false;

        // Row lock: serialises concurrent reviews of the same company so the
        // "already rejected?" check below and the counter increment are consistent.
        const existingCompany = await companyRepository.getCompanyById(companyId, { transaction, lock: true });
        if (!existingCompany) {
            await transaction.rollback();
            return ServiceResponse.error({ message: KYC_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 404 });
        }

        // Approving would leave a KYC-approved company that still cannot sign in. Refuse
        // until the block is lifted (fails closed if the lookup errors).
        if (action === 'approve') {
            const blockRes = await emailBlockService.checkEmail(existingCompany.company_email, { transaction });
            if (!blockRes.success || blockRes.data.blocked) {
                await transaction.rollback();
                return blockRes.success
                    ? ServiceResponse.error({ message: EMAIL_BLOCK_MESSAGES.APPROVE_BLOCKED, statusCode: 409 })
                    : ServiceResponse.error({ message: blockRes.message, statusCode: blockRes.statusCode });
            }
        }

        const updatedCompany = await companyRepository.updateKycStatus(
            companyId,
            { isKycVerified, status, rejectionReason: reason },
            { transaction }
        );

        let kycRejectionCount = existingCompany.kyc_rejection_count ?? 0;
        let blockedUserIds = [];
        let isEmailBlocked = false;

        if (action === 'reject' && existingCompany.kyc_status !== KYC_STATUS.REJECTED) {
            // Only a transition into Rejected is a new strike — re-submitting the same
            // rejection (double click, retry) must not burn another attempt.
            const counted = await companyRepository.incrementKycRejectionCount(companyId, { transaction });
            kycRejectionCount = counted.kyc_rejection_count;

            if (kycRejectionCount >= rejectionLimit) {
                const companyUsers = await companyRepository.getCompanyUser(companyId);
                blockedUserIds = companyUsers.map((u) => u.id);

                await emailBlockService.applyBlock({
                    email: existingCompany.company_email,
                    companyId,
                    userIds: blockedUserIds,
                    reason: BLOCK_REASONS.KYC_REJECTED_MAX,
                    blockedBy: adminId,
                    rejectionCount: kycRejectionCount,
                    rejectionLimit
                }, { transaction });
                isEmailBlocked = true;
            }
        }

        if (action === 'approve') {
            const user = await companyRepository.getCompanyUser(companyId);
            const userId = user[0].id;
            // Privileged: is_active is admin/KYC-owned and is stripped from self-service
            // updateUser(). Same transaction as the KYC status write so a failed
            // activate rolls the approval back.
            await userRepository.updateUser(
                { is_active: true },
                userId,
                { transaction, allowPrivileged: true }
            );

            await companyRepository.markDefaultProfileCompleted(userId, companyId, { transaction });

            const [allowedConnections, allowedFreeTrialDays] = await Promise.all([
                adminConfigService.getTrialConfigValue(TRIAL_CONFIG_LOOKUP_KEYS.FREE_CONNECTION_LIMIT, USER_LIMIT_DEFAULTS.ALLOWED_CONNECTIONS),
                adminConfigService.getTrialConfigValue(TRIAL_CONFIG_LOOKUP_KEYS.FREE_TRIAL_DAY, USER_LIMIT_DEFAULTS.ALLOWED_FREE_TRIAL_DAYS)
            ]);

            await userLimitConfigRepository.createDefaultUserLimitConfig(
                userId,
                { allowed_connections: allowedConnections, allowed_free_trial_days: allowedFreeTrialDays },
                adminId,
                { transaction }
            );
        }

        await transaction.commit();

        // Best effort, after commit: Postgres is the source of truth.
        if (isEmailBlocked) {
            await emailBlockService.invalidateSessionCache(blockedUserIds);
        }

        const data = typeof updatedCompany?.toJSON === 'function' ? updatedCompany.toJSON() : updatedCompany;
        return ServiceResponse.success({
            message: KYC_MESSAGES.REVIEW_ACTION_SUCCESS,
            data: action === 'reject'
                ? { ...data, kycRejectionCount, maxRejections: rejectionLimit, isEmailBlocked }
                : data,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 500 });
    }
};

module.exports = { createKycInfo, getKycInfo, updateDocumentStatus, updateReviewStatus, decyptKycInfo, prepareResponse };
