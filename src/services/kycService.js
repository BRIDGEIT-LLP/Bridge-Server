'use strict';
const { sequelize } = require('../models');
const kycInfoRepository = require('../repositories/kycInfoRepository');
const companyRepository = require('../repositories/companyRepository');
const userLimitConfigRepository = require('../repositories/userLimitConfigRepository');
const adminConfigService = require('./adminConfigService');
const emailBlockService = require('./emailBlockService');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { KYC_MESSAGES, ENCRYPT_DECRYPT_MESSAGES, KYC_STATUS, KYC_DOC_TYPES, KYC_REQUIRED_DOCS, KYC_COMPANY_NUMBER_FIELD, KYC_DOC_SPECS, KYC_DOC_LABEL_OVERRIDES, TRIAL_CONFIG_LOOKUP_KEYS, USER_LIMIT_DEFAULTS, BLOCK_REASONS, EMAIL_BLOCK_MESSAGES } = require('../utils/constant');
const { encrypt, decrypt } = require("../utils/encryption");
const { PAN_PATTERN } = require('../validations/businessCheckValidation');

const AADHAAR_PATTERN = /^[0-9]{12}$/;
// Roles we do not know keep the original identity-document pair.
const DEFAULT_REQUIRED_DOCS = ['AADHAAR', 'PAN'];
const userRepository = require('../repositories/userRepository');

const createKycInfo = async (records, { roleCode, draft = false } = {}) => {
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

            if (draft && existing?.status === KYC_STATUS.APPROVED) continue;

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
        if (!draft && company?.kyc_status === KYC_STATUS.REJECTED) {
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
        if (!draft && !company?.is_kyc_uploaded) {
            const allRecords = await kycInfoRepository.findAllKycRecords(
                { userId: normalized[0].user_id, companyId, roleId: normalized[0].role_id },
                { transaction }
            );
            // A row without a file does not count: the Business step already stores the PAN number
            // on its own, before any document is uploaded.
            const uploadedTypes = new Set(allRecords.filter(r => r.front_s3_key).map(r => r.document_type));
            const requiredDocs = KYC_REQUIRED_DOCS[roleCode] || DEFAULT_REQUIRED_DOCS;
            const hasAllRequiredDocs = requiredDocs.every(type => uploadedTypes.has(type));
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

const readCompanyIdentifier = (company, field) => {
    const value = company?.[field];
    if (typeof value !== 'string' || value.trim() === '') return null;
    const iv = company[`${field}_iv`];
    const authTag = company[`${field}_auth_tag`];
    return iv && authTag ? decrypt(value, iv, authTag) : value;
};

const hasFile = (side) => !!(side && side.s3_key);

/**
 * Draft counterpart of the per-type checks in buildKycRecords: a document with neither a file nor a number is
 * skipped, files are not required, and only the fields that are present go into the row so a draft never blanks
 * something already saved. A number that is sent must still be well formed.
 */
const buildDraftRecord = ({ type, doc, userId, companyId, roleId, company }) => {
    const record = { user_id: userId, company_id: companyId, role_id: roleId, document_type: type, status: KYC_STATUS.PENDING };
    if (hasFile(doc.front)) {
        Object.assign(record, {
            front_s3_key: doc.front.s3_key,
            front_file_name: doc.front.file_name,
            front_file_size: doc.front.file_size,
            front_mime_type: doc.front.mimetype
        });
    }
    if (hasFile(doc.back)) {
        Object.assign(record, {
            back_s3_key: doc.back.s3_key,
            back_file_name: doc.back.file_name,
            back_file_size: doc.back.file_size,
            back_mime_type: doc.back.mimetype
        });
    }

    let number = typeof doc.number === 'string' ? doc.number.trim() : '';
    if (type === 'AADHAAR' && number && !AADHAAR_PATTERN.test(number)) return { error: KYC_MESSAGES.NUMBER_INVALID(type) };
    if (type === 'PAN') {
        number = number.toUpperCase();
        if (number && !PAN_PATTERN.test(number)) return { error: KYC_MESSAGES.NUMBER_INVALID(type) };
    }
    if (KYC_COMPANY_NUMBER_FIELD[type]) number = readCompanyIdentifier(company, KYC_COMPANY_NUMBER_FIELD[type]) || '';
    if (type === 'PITCH_DECK') number = '';
    if (number) {
        const { encryptedData, iv, authTag } = encrypt(number);
        Object.assign(record, { document_number: encryptedData, document_number_iv: iv, document_number_auth_tag: authTag });
    }

    const hasContent = record.front_s3_key || record.back_s3_key || record.document_number;
    return { record: hasContent ? record : null };
};

/**
 * Turns the save-kyc-info body ({ DOC_TYPE: { number?, front, back? } }) into kyc_info rows and keeps
 * each document number tied to its document:
 *  - only the role's own document types are accepted (KYC_REQUIRED_DOCS), each needs its front file
 *  - AADHAAR needs a 12-digit number and a back file
 *  - PAN's number is the one saved on the Business step; it may be omitted here, and if sent it must match
 *  - GST_CERTIFICATE / INCORPORATION_CERTIFICATE carry the company's verified GSTIN / CIN, taken from the
 *    company record rather than from the client
 *  - PITCH_DECK has no number
 */
const buildKycRecords = async ({ userId, companyId, roleId, roleCode, payload, draft = false }) => {
    const types = payload && typeof payload === 'object' ? Object.keys(payload) : [];
    if (types.length === 0 && !draft) {
        return ServiceResponse.error({ message: KYC_MESSAGES.EMPTY_PAYLOAD, statusCode: 400 });
    }

    const allowed = KYC_REQUIRED_DOCS[roleCode] || DEFAULT_REQUIRED_DOCS;
    const company = await companyRepository.getCompanyById(companyId);
    const records = [];

    for (const type of types) {
        if (!KYC_DOC_TYPES.includes(type) || !allowed.includes(type)) {
            return ServiceResponse.error({ message: KYC_MESSAGES.INVALID_DOC_TYPE(type), statusCode: 400 });
        }
        const doc = payload[type] || {};
        if (draft) {
            const draftRecord = buildDraftRecord({ type, doc, userId, companyId, roleId, company });
            if (draftRecord.error) return ServiceResponse.error({ message: draftRecord.error, statusCode: 400 });
            if (draftRecord.record) records.push(draftRecord.record);
            continue;
        }
        if (!hasFile(doc.front)) {
            return ServiceResponse.error({ message: KYC_MESSAGES.FILE_REQUIRED(type, 'front'), statusCode: 400 });
        }
        if (type === 'AADHAAR' && !hasFile(doc.back)) {
            return ServiceResponse.error({ message: KYC_MESSAGES.FILE_REQUIRED(type, 'back'), statusCode: 400 });
        }

        let number = typeof doc.number === 'string' ? doc.number.trim() : '';
        if (type === 'AADHAAR') {
            if (!AADHAAR_PATTERN.test(number)) {
                return ServiceResponse.error({ message: KYC_MESSAGES.NUMBER_INVALID(type), statusCode: 400 });
            }
        } else if (type === 'PAN') {
            number = number.toUpperCase();
            const existing = await kycInfoRepository.findKycRecord({ userId, companyId, roleId, documentType: 'PAN' });
            const saved = existing?.document_number && existing.document_number_iv && existing.document_number_auth_tag
                ? decrypt(existing.document_number, existing.document_number_iv, existing.document_number_auth_tag)
                : '';
            if (number && saved && number !== saved) {
                return ServiceResponse.error({ message: KYC_MESSAGES.PAN_MISMATCH, statusCode: 400 });
            }
            number = number || saved;
            if (!PAN_PATTERN.test(number)) {
                return ServiceResponse.error({ message: KYC_MESSAGES.NUMBER_REQUIRED(type), statusCode: 400 });
            }
        } else if (KYC_COMPANY_NUMBER_FIELD[type]) {
            number = readCompanyIdentifier(company, KYC_COMPANY_NUMBER_FIELD[type]) || '';
            if (!number) {
                return ServiceResponse.error({ message: KYC_MESSAGES.IDENTIFIER_MISSING(type), statusCode: 400 });
            }
        } else {
            number = '';
        }

        const record = {
            user_id: userId,
            company_id: companyId,
            role_id: roleId,
            document_type: type,
            status: KYC_STATUS.PENDING,
            front_s3_key: doc.front.s3_key,
            front_file_name: doc.front.file_name,
            front_file_size: doc.front.file_size,
            front_mime_type: doc.front.mimetype,
            document_number: null,
            document_number_iv: null,
            document_number_auth_tag: null
        };
        if (number) {
            const { encryptedData, iv, authTag } = encrypt(number);
            Object.assign(record, { document_number: encryptedData, document_number_iv: iv, document_number_auth_tag: authTag });
        }
        if (hasFile(doc.back)) {
            Object.assign(record, {
                back_s3_key: doc.back.s3_key,
                back_file_name: doc.back.file_name,
                back_file_size: doc.back.file_size,
                back_mime_type: doc.back.mimetype
            });
        }
        records.push(record);
    }

    return ServiceResponse.success({ data: records, statusCode: 200 });
};

const fileInfo = (record, side) => {
    const key = record?.[`${side}_s3_key`];
    if (!key) return null;
    return {
        s3_key: key,
        file_name: record[`${side}_file_name`] ?? null,
        file_size: record[`${side}_file_size`] ?? null,
        mimetype: record[`${side}_mime_type`] ?? null
    };
};

/**
 * What the registration "Documents" step needs for the logged-in user's role: the documents to upload,
 * the number tied to each (PAN from the Business step, GSTIN/CIN from the company, Aadhaar once typed)
 * and whatever is already uploaded with its review status, so the page can prefill and resume.
 */
const getKycRequirements = async ({ userId, companyId, roleId, roleCode }) => {
    try {
        const required = KYC_REQUIRED_DOCS[roleCode];
        if (!required) {
            return ServiceResponse.error({ message: KYC_MESSAGES.ROLE_NOT_SUPPORTED, statusCode: 403 });
        }

        const [company, records] = await Promise.all([
            companyRepository.getCompanyById(companyId),
            kycInfoRepository.findAllKycRecordsRaw({ userId, companyId, roleId })
        ]);
        const byType = new Map(records.map(r => [r.document_type, r]));

        const documents = required.map((type) => {
            const spec = { ...KYC_DOC_SPECS[type], ...(KYC_DOC_LABEL_OVERRIDES[roleCode]?.[type] || {}) };
            const record = byType.get(type);

            let number = null;
            if (spec.numberSource === 'company') {
                number = readCompanyIdentifier(company, KYC_COMPANY_NUMBER_FIELD[type]);
            } else if (spec.numberSource === 'user' && record?.document_number && record.document_number_iv && record.document_number_auth_tag) {
                number = decrypt(record.document_number, record.document_number_iv, record.document_number_auth_tag);
            }

            const files = {};
            for (const side of spec.sides) files[side] = fileInfo(record, side);
            const uploaded = spec.sides.every(side => files[side]);

            return {
                document_type: type,
                label: spec.label,
                required: true,
                sides: spec.sides,
                accepted_mime_types: spec.mimeTypes,
                max_size_mb: spec.maxSizeMB,
                number_label: spec.numberLabel,
                number_source: spec.numberSource,
                // user-typed numbers can be edited until review; company ones come from the verified record
                number_editable: spec.numberSource === 'user' && record?.status !== KYC_STATUS.APPROVED,
                number,
                files,
                uploaded,
                status: record?.status ?? null,
                rejection_reason: record?.rejection_reason ?? null
            };
        });

        return ServiceResponse.success({
            message: KYC_MESSAGES.REQUIREMENTS_FETCHED,
            data: {
                role: roleCode,
                documents,
                kyc_status: company?.kyc_status ?? null,
                rejection_reason: company?.kyc_rejection_reason ?? null,
                is_kyc_uploaded: !!company?.is_kyc_uploaded,
                registered_address: company?.kyc_address ?? '',
                kyc_consent: !!company?.kyc_consent
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.FETCH_FAILED, statusCode: 500 });
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

module.exports = { createKycInfo, buildKycRecords, getKycRequirements, getKycInfo, updateDocumentStatus, updateReviewStatus, decyptKycInfo, prepareResponse };
