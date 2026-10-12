'use strict';
const { sequelize } = require('../models');
const kycInfoRepository = require('../repositories/kycInfoRepository');
const companyRepository = require('../repositories/companyRepository');
const userLimitConfigRepository = require('../repositories/userLimitConfigRepository');
const adminConfigService = require('./adminConfigService');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { KYC_MESSAGES, ENCRYPT_DECRYPT_MESSAGES, KYC_STATUS, KYC_DOC_TYPES, TRIAL_CONFIG_LOOKUP_KEYS, USER_LIMIT_DEFAULTS } = require('../utils/constant');
const { decrypt } = require("../utils/encryption");
const userRepository = require('../repositories/userRepository');

const createKycInfo = async (records) => {
    const transaction = await sequelize.transaction();
    try {
        if (!Array.isArray(records) || records.length === 0) {
            return ServiceResponse.error({ message: 'records must be a non-empty array.', statusCode: 400 });
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

        return ServiceResponse.success({
            message: KYC_MESSAGES.FETCH_SUCCESS,
            data: {
                records,
                kycStatus: company?.kyc_status ?? null,
                rejectionReason: company?.kyc_rejection_reason ?? null
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
    const transaction = await sequelize.transaction();
    try {
        const status = action === 'approve' ? KYC_STATUS.APPROVED : KYC_STATUS.REJECTED;
        const reason = action === 'reject' ? (rejectionReason ?? null) : null;
        const isKycVerified = status === KYC_STATUS.APPROVED ? true : false;

        const updatedCompany = await companyRepository.updateKycStatus(
            companyId,
            { isKycVerified, status, rejectionReason: reason },
            { transaction }
        );

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
        return ServiceResponse.success({ message: KYC_MESSAGES.REVIEW_ACTION_SUCCESS, data: updatedCompany, statusCode: 200 });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 500 });
    }
};

module.exports = { createKycInfo, getKycInfo, updateDocumentStatus, updateReviewStatus, decyptKycInfo, prepareResponse };
