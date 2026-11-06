'use strict';
const { sequelize } = require('../models');
const companyRepository = require('../repositories/companyRepository');
const kycInfoRepository = require('../repositories/kycInfoRepository');
const cinVerificationService = require('./cinVerificationService');
const gstVerificationService = require('./gstVerificationService');
const ServiceResponse = require('../utils/ServiceResponse');
const { errorLogger } = require('../configs/logger');
const { encrypt, decrypt } = require('../utils/encryption');
const { GST_MESSAGES, CIN_MESSAGES, KYC_STATUS, BUSINESS_CHECK_MESSAGES } = require('../utils/constant');

const isFilled = (v) => typeof v === 'string' && v.trim() !== '';

/**
 * What the "Check your business" step asks for, per role.
 *   B2B      - GSTIN + CIN, both required and verified here (PAN comes with the Documents step)
 *   STARTUP  - CIN (verified here) + PAN, both required
 *   INVESTOR - PAN required, fund/company CIN optional (verified when given)
 */
const REQUIREMENTS = {
    B2B: { gst: 'required', cin: 'required', pan: 'none' },
    STARTUP: { gst: 'none', cin: 'required', pan: 'required' },
    INVESTOR: { gst: 'none', cin: 'optional', pan: 'required' }
};

/**
 * Saves the identifiers for the Business step and returns what is now on record.
 *  - GSTIN / CIN go to company.gst_number / cin_number with their is_*_verified flags. Like elsewhere they are
 *    company-owned and locked once set: re-sending the same value is a no-op, a different value is refused.
 *  - PAN goes to kyc_info (document_type 'PAN') with an AES-GCM encrypted document_number and no file yet;
 *    the Documents step later attaches the file to the same row (kycService upserts per document type).
 */
const saveBusinessCheck = async ({ userId, companyId, roleId, role, body, draft = false, step = null }) => {
    const rules = REQUIREMENTS[role];
    if (!rules) {
        return ServiceResponse.error({ message: BUSINESS_CHECK_MESSAGES.ROLE_NOT_SUPPORTED, statusCode: 403 });
    }

    const company = await companyRepository.getCompanyById(companyId);
    if (!company) {
        return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
    }

    const gst = isFilled(body.gst_number) ? body.gst_number : '';
    const cin = isFilled(body.cin_number) ? body.cin_number : '';
    const pan = isFilled(body.pan_number) ? body.pan_number : '';

    const missing = [];
    if (rules.gst === 'required' && !gst) missing.push('gst_number');
    if (rules.cin === 'required' && !cin) missing.push('cin_number');
    if (rules.pan === 'required' && !pan) missing.push('pan_number');
    if (missing.length && !draft) {
        return ServiceResponse.error({
            message: `${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} required for this role.`,
            statusCode: 400
        });
    }

    // GSTIN: only roles that ask for it; anyone else sending one is ignored.
    let gstPatch = null;
    if (gst && rules.gst !== 'none') {
        if (isFilled(company.gst_number)) {
            if (company.gst_number !== gst) {
                return ServiceResponse.error({ message: GST_MESSAGES.ALREADY_SET, statusCode: 400 });
            }
        } else {
            const gstVerifyRes = await gstVerificationService.verifyGst(gst);
            if (!gstVerifyRes.success) {
                return ServiceResponse.error({
                    message: gstVerifyRes.message || GST_MESSAGES.VERIFY_FAILED,
                    statusCode: gstVerifyRes.statusCode || 400
                });
            }
            gstPatch = { gst_number: gst, is_gst_verified: true };
        }
    }

    let cinPatch = null;
    if (cin) {
        if (isFilled(company.cin_number)) {
            if (company.cin_number !== cin) {
                return ServiceResponse.error({ message: CIN_MESSAGES.ALREADY_SET, statusCode: 400 });
            }
        } else {
            const cinVerifyRes = await cinVerificationService.verifyCin(cin);
            if (!cinVerifyRes.success) {
                return ServiceResponse.error({
                    message: cinVerifyRes.message || CIN_MESSAGES.VERIFY_FAILED,
                    statusCode: cinVerifyRes.statusCode || 400
                });
            }
            cinPatch = { cin_number: cin, is_cin_verified: true };
        }
    }

    const transaction = await sequelize.transaction();
    try {
        const identifierPatch = { ...(gstPatch || {}), ...(cinPatch || {}) };
        if (Object.keys(identifierPatch).length) {
            await companyRepository.updateCompanyIdentifiers(companyId, identifierPatch, { transaction });
        }

        let panSaved = false;
        if (pan) {
            const existing = await kycInfoRepository.findKycRecord(
                { userId, companyId, roleId, documentType: 'PAN' },
                { transaction }
            );
            if (existing && existing.status === KYC_STATUS.APPROVED) {
                await transaction.rollback();
                return ServiceResponse.error({ message: BUSINESS_CHECK_MESSAGES.PAN_LOCKED, statusCode: 400 });
            }
            const { encryptedData, iv, authTag } = encrypt(pan);
            const record = {
                document_number: encryptedData,
                document_number_iv: iv,
                document_number_auth_tag: authTag
            };
            if (existing) {
                await kycInfoRepository.updateKycRecord(existing.id, record, { transaction });
            } else {
                await kycInfoRepository.createKycRecord({
                    user_id: userId,
                    company_id: companyId,
                    role_id: roleId,
                    document_type: 'PAN',
                    status: KYC_STATUS.PENDING,
                    created_at: new Date(),
                    ...record
                }, { transaction });
            }
            panSaved = true;
        }

        // a draft remembers the step; a normal Continue clears the draft marker
        await companyRepository.setDraftStep(userId, companyId, roleId, draft ? step : null, { transaction });

        await transaction.commit();
        return ServiceResponse.success({
            data: {
                gst_verified: !!(gstPatch || (gst && company.is_gst_verified)),
                cin_verified: !!(cinPatch || (cin && company.is_cin_verified)),
                pan_saved: panSaved
            },
            message: BUSINESS_CHECK_MESSAGES.SAVED
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: BUSINESS_CHECK_MESSAGES.SAVE_FAILED, statusCode: 500 });
    }
};

// company identifiers are plain text today, but honour the iv/auth_tag columns if they get encrypted later
const readCompanyId = (company, field) => {
    const value = company[field];
    if (!isFilled(value)) return null;
    const iv = company[`${field}_iv`];
    const authTag = company[`${field}_auth_tag`];
    return iv && authTag ? decrypt(value, iv, authTag) : value;
};

/**
 * Returns what saveBusinessCheck stored, in the same shape the step collects it, so the UI can prefill.
 *  - gst_number / cin_number / *_verified come from the company
 *  - pan_number is decrypted from the user's PAN kyc_info row (null until saved)
 */
const getBusinessCheck = async ({ userId, companyId, roleId, role }) => {
    if (!REQUIREMENTS[role]) {
        return ServiceResponse.error({ message: BUSINESS_CHECK_MESSAGES.ROLE_NOT_SUPPORTED, statusCode: 403 });
    }

    const company = await companyRepository.getCompanyById(companyId);
    if (!company) {
        return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
    }

    let panNumber = null;
    let panStatus = null;
    const kyc = await kycInfoRepository.findKycRecord({ userId, companyId, roleId, documentType: 'PAN' });
    if (kyc) {
        panStatus = kyc.status;
        if (kyc.document_number && kyc.document_number_iv && kyc.document_number_auth_tag) {
            panNumber = decrypt(kyc.document_number, kyc.document_number_iv, kyc.document_number_auth_tag);
        }
    }

    return ServiceResponse.success({
        data: {
            role,
            gst_number: readCompanyId(company, 'gst_number'),
            is_gst_verified: !!company.is_gst_verified,
            cin_number: readCompanyId(company, 'cin_number'),
            is_cin_verified: !!company.is_cin_verified,
            pan_number: panNumber,
            pan_status: panStatus
        },
        message: BUSINESS_CHECK_MESSAGES.FETCHED
    });
};

module.exports = { saveBusinessCheck, getBusinessCheck, REQUIREMENTS };
