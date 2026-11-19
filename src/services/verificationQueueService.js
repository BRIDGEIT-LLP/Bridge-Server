'use strict';
const verificationQueueRepository = require('../repositories/verificationQueueRepository');
const kycInfoRepository = require('../repositories/kycInfoRepository');
const emailBlockService = require('./emailBlockService');
const ServiceResponse = require('../utils/ServiceResponse');
const { errorLogger } = require('../configs/logger');
const { VERIFICATION_QUEUE_MESSAGES } = require('../utils/constant');
const { decrypt } = require('../utils/encryption');

// company identifiers are plain text today, but honour the iv/auth_tag columns if they
// get encrypted later — mirrors businessCheckService.readCompanyId.
const readIdentifier = (row, field) => {
    const value = row?.[field];
    if (typeof value !== 'string' || value.trim() === '') return null;
    const iv = row[`${field}_iv`];
    const authTag = row[`${field}_auth_tag`];
    return iv && authTag ? decrypt(value, iv, authTag) : value;
};

// Shared shape between the list row and the detail payload (FRD §12.5 Verification queue).
const toListItem = (row) => ({
    companyId: row.company_id,
    applicantName: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
    profilePhoto: row.profile_photo,
    companyName: row.company_name,
    city: row.city,
    role: row.role_code,
    submittedAt: row.submitted_at,
    gstStatus: row.gst_verification_status,
    mcaStatus: row.mca_verification_status,
    panStatus: row.pan_verification_status,
    nameMatchStatus: row.name_match_status,
    // Free text only — no vouch/referral system exists yet (FRD §3.7/§12.7).
    vouchedByName: row.vouched_by_name,
    kycRejectionCount: row.kyc_rejection_count ?? 0,
    funding: {
        stage: row.funding_stage,
        askAmountMin: row.funding_ask_amt_min,
        askAmountMax: row.funding_ask_amt_max,
        currency: row.funding_currency,
        ticketSizeMin: row.ticket_size_amt_min,
        ticketSizeMax: row.ticket_size_amt_max,
        ticketCurrency: row.ticket_currency
    }
});

const getVerificationQueueList = async () => {
    try {
        const rows = await verificationQueueRepository.getVerificationQueueList();
        return ServiceResponse.success({
            message: VERIFICATION_QUEUE_MESSAGES.LIST_SUCCESS,
            data: rows.map(toListItem),
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: VERIFICATION_QUEUE_MESSAGES.LIST_FAILED, statusCode: 500 });
    }
};

const getVerificationQueueDetail = async (companyId) => {
    try {
        const row = await verificationQueueRepository.getVerificationQueueDetail(companyId);
        if (!row) {
            return ServiceResponse.error({ message: VERIFICATION_QUEUE_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        const [documents, maxRejections] = await Promise.all([
            kycInfoRepository.findAllKycRecordsRaw({ userId: row.user_id, companyId, roleId: row.role_id }),
            emailBlockService.getRejectionLimit()
        ]);

        return ServiceResponse.success({
            message: VERIFICATION_QUEUE_MESSAGES.DETAIL_SUCCESS,
            data: {
                ...toListItem(row),
                gstin: readIdentifier(row, 'gst_number'),
                cin: readIdentifier(row, 'cin_number'),
                nameMatchNote: row.name_match_note,
                maxRejections,
                documents: documents.map((d) => ({
                    documentType: d.document_type,
                    status: d.status,
                    frontS3Key: d.front_s3_key,
                    frontFileName: d.front_file_name,
                    backS3Key: d.back_s3_key,
                    backFileName: d.back_file_name
                }))
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: VERIFICATION_QUEUE_MESSAGES.DETAIL_FAILED, statusCode: 500 });
    }
};

module.exports = { getVerificationQueueList, getVerificationQueueDetail };
