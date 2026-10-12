'use strict';
const { sequelize } = require('../models');
const userRepository = require('../repositories/userRepository');
const companyRepository = require('../repositories/companyRepository');
const connectionRepository = require('../repositories/connectionRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const gstVerificationService = require('./gstVerificationService');
const cinVerificationService = require('./cinVerificationService');
const { USER_MESSAGES, KYC_MESSAGES, GST_MESSAGES, CIN_MESSAGES } = require('../utils/constant');
const { decrypt } = require('../utils/encryption');
const { getConnectableRoles } = require('../matching/eligibilityService');

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const CIN_PATTERN = /^[A-Z]{1}[0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;

const isFilled = (value) => value !== null && value !== undefined && value !== '';

const normalizeIdentifier = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

/**
 * GST/CIN are company-owned and locked after they exist. PUT /users/profile may
 * set them only while the company row is still empty (Investor/Startup → B2B),
 * and only after the same verification registration uses.
 */
const prepareCompanyIdentifierPatch = async (userData, companyId) => {
    const gstNumber = normalizeIdentifier(userData?.gst_number);
    const cinNumber = normalizeIdentifier(userData?.cin_number);
    if (!gstNumber && !cinNumber) {
        return ServiceResponse.success({ data: {} });
    }

    const company = await companyRepository.getCompanyById(companyId);
    if (!company) {
        return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
    }

    const patch = {};

    if (gstNumber) {
        if (isFilled(company.gst_number)) {
            return ServiceResponse.error({ message: GST_MESSAGES.ALREADY_SET, statusCode: 400 });
        }
        if (!GSTIN_PATTERN.test(gstNumber)) {
            return ServiceResponse.error({ message: GST_MESSAGES.INVALID_FORMAT, statusCode: 400 });
        }
        const gstVerifyRes = await gstVerificationService.verifyGst(gstNumber);
        if (!gstVerifyRes.success) {
            return ServiceResponse.error({
                message: gstVerifyRes.message || GST_MESSAGES.VERIFY_FAILED,
                statusCode: gstVerifyRes.statusCode || 400
            });
        }
        patch.gst_number = gstNumber;
        patch.is_gst_verified = true;
    }

    if (cinNumber) {
        if (isFilled(company.cin_number)) {
            return ServiceResponse.error({ message: CIN_MESSAGES.ALREADY_SET, statusCode: 400 });
        }
        if (!CIN_PATTERN.test(cinNumber)) {
            return ServiceResponse.error({ message: CIN_MESSAGES.INVALID_FORMAT, statusCode: 400 });
        }
        const cinVerifyRes = await cinVerificationService.verifyCin(cinNumber);
        if (!cinVerifyRes.success) {
            return ServiceResponse.error({
                message: cinVerifyRes.message || CIN_MESSAGES.VERIFY_FAILED,
                statusCode: cinVerifyRes.statusCode || 400
            });
        }
        patch.cin_number = cinNumber;
        patch.is_cin_verified = true;
    }

    return ServiceResponse.success({ data: patch });
};

const createUserProfile = async ({ userData, companyId, userId, roleId }) => {
    const transaction = await sequelize.transaction();
    try {

        const user = await userRepository.updateUser(userData, userId, { transaction });
        await companyRepository.updateCompanyContact(companyId, userData, { transaction });
        await companyRepository.markProfileCompleted(userId, companyId, roleId, { transaction });

        await transaction.commit();
        return ServiceResponse.success({
            message: USER_MESSAGES.CREATE_SUCCESS,
            data: { id: user.id },
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

const getUserList = async () => {
    try {
        const users = await userRepository.getUserList();
        return ServiceResponse.success({ message: USER_MESSAGES.USER_LISTING_SUCCESS, data: users, statusCode: 200 });
    } catch (error) {
        return ServiceResponse.error({ message: USER_MESSAGES.USER_LISTING_FAILURE, data: [], statusCode: 500 });
    }
}

const getSwitchedRoleUsers = async () => {
    try {
        const users = await userRepository.getUsersWithSwitchedRoles();
        return ServiceResponse.success({ message: USER_MESSAGES.SWITCHED_ROLE_LISTING_SUCCESS, data: users, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.SWITCHED_ROLE_LISTING_FAILURE, data: [], statusCode: 500 });
    }
};

const searchUsers = async (searchQuery, roleCode, excludeUserId, viewerRoleId) => {
    try {
        const searchableRoles = getConnectableRoles(roleCode);
        const users = await userRepository.searchUsers(searchQuery, searchableRoles, excludeUserId, excludeUserId, viewerRoleId);
        return ServiceResponse.success({ message: USER_MESSAGES.SEARCH_SUCCESS, data: users, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.SEARCH_FAILED, data: [], statusCode: 500 });
    }
};

const getUserKycDocs = async () => {
    try {
        const rows = await userRepository.getUserKycDocs();

        const userMap = new Map();

        for (const row of rows) {
            if (!userMap.has(row.uid)) {
                userMap.set(row.uid, {
                    user_id: row.uid,
                    company_id: row.cid,
                    first_name: row.first_name,
                    last_name: row.last_name,
                    profile_photo: row.profile_photo,
                    company_email: row.company_email,
                    company_name: row.company_name,
                    country_code: row.country_code,
                    mobile_number: row.mobile_number,
                    is_email_verified: row.is_email_verified,
                    is_mobile_number_verified: row.is_mobile_number_verified,
                    kyc_status: row.kyc_status,
                    is_kyc_verified: row.is_kyc_verified,
                    kyc_rejection_reason: row.kyc_rejection_reason,
                    kyc_documents: []
                });
            }

            if (row.kyc_id) {
                let document_number = null;
                if (row.document_number && row.document_number_iv && row.document_number_auth_tag) {
                    document_number = decrypt(row.document_number, row.document_number_iv, row.document_number_auth_tag);
                }

                userMap.get(row.uid).kyc_documents.push({
                    kyc_id: row.kyc_id,
                    document_type: row.document_type,
                    document_number,
                    front_s3_key: row.front_s3_key,
                    front_file_name: row.front_file_name,
                    back_s3_key: row.back_s3_key,
                    back_file_name: row.back_file_name,
                    kyc_status: row.document_status,
                    rejection_reason: row.rejection_reason,
                    verified_at: row.verified_at,
                    kyc_uploaded_at: row.kyc_uploaded_at
                });
            }
        }

        const data = Array.from(userMap.values());
        return ServiceResponse.success({ message: KYC_MESSAGES.KYC_LISTING_SUCCESS, data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: KYC_MESSAGES.KYC_LISTING_FAILED, data: [], statusCode: 500 });
    }
}

const getUserProfile = async ({ companyId, userId, roleId }) => {
    try {
        if (!userId || !roleId || !companyId) {
            return ServiceResponse.error({
                message: `Missing required token fields: userId=${userId}, roleId=${roleId}, companyId=${companyId}. Please log in again to get a fresh token.`,
                statusCode: 400
            });
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return ServiceResponse.error({ message: 'User not found.', statusCode: 404 });
        }

        const company = await companyRepository.getCompanyById(companyId);
        if (!company) {
            return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
        }

        const fieldsConfig = await userRepository.getUserProfileFieldsConfig(roleId);

        // `user_profile_field_master` lists company_email / mobile_number / country_code
        // twice per role (company + user). Keep one row, preferring `user` — that is
        // the copy PUT /users/profile writes, and what My Profile already shows.
        const byName = new Map();
        for (const raw of fieldsConfig || []) {
            const config = typeof raw.get === 'function' ? raw.get({ plain: true }) : raw;
            if (config.field_name === 'company_name') continue;
            const existing = byName.get(config.field_name);
            if (existing && existing.source_table === 'user' && config.source_table !== 'user') continue;
            byName.set(config.field_name, config);
        }

        const data = Array.from(byName.values()).map(config => {
            let value;
            if (config.source_table === 'user') {
                value = user[config.field_name];
            } else if (config.source_table === 'company') {
                value = company[config.field_name];
            }

            // Empty value, typed to match the field's declared `type`. An unset array
            // column must come back as [] rather than '' — a client that renders a
            // multi-select straight from this response would otherwise get a string
            // where it expects a list (and `''.map is not a function` on refresh).
            if (value === null || value === undefined) {
                value = config.type === 'array' ? [] : '';
            }

            return {
                label: config.display_name,
                columnName: config.field_name,
                value: value,
                isEditable: config.is_editable,
                type: config.type
            };
        });

        return ServiceResponse.success({
            message: 'User profile retrieved successfully.',
            data: data,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        console.error('[getUserProfile ERROR]', error.message, error.stack);
        return ServiceResponse.error({ message: error.message || 'Error retrieving user profile.', statusCode: 500 });
    }
};

/**
 * Other-user profile (navbar search / role-details): same fields as getUserProfile,
 * plus the live blocking connection status between the viewer and this role pair.
 * `connection_status` is null when no Pending/Viewed/Accepted/Deferred row exists.
 */
const getViewedUserProfile = async ({ companyId, userId, roleId, viewerUserId, viewerRoleId }) => {
    const profile = await getUserProfile({ companyId, userId, roleId });
    if (!profile.success) {
        return profile;
    }

    let connectionStatus = null;
    try {
        if (viewerUserId && viewerRoleId) {
            const existing = await connectionRepository.findExistingConnection(
                viewerUserId,
                viewerRoleId,
                userId,
                roleId
            );
            connectionStatus = existing?.status ?? null;
        }
    } catch (error) {
        errorLogger.error(error);
    }

    return ServiceResponse.success({
        message: profile.message,
        data: {
            fields: profile.data,
            connection_status: connectionStatus
        },
        statusCode: profile.statusCode
    });
};

const updateUserProfile = async (userData, user_id, companyId) => {
    const identifierRes = await prepareCompanyIdentifierPatch(userData, companyId);
    if (!identifierRes.success) {
        return identifierRes;
    }

    const transaction = await sequelize.transaction();
    try {
        const user = await userRepository.updateUser(userData, user_id, { transaction });
        await companyRepository.updateCompanyContact(companyId, userData, { transaction });
        if (identifierRes.data && Object.keys(identifierRes.data).length > 0) {
            await companyRepository.updateCompanyIdentifiers(companyId, identifierRes.data, { transaction });
        }
        await transaction.commit();
        return ServiceResponse.success({
            message: USER_MESSAGES.UPDATE_SUCCESS,
            data: { user },
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
}

const getUserRoleDetails = async (targetUserId, companyId, roleId) => {
    try {
        const user = await userRepository.getUserById(targetUserId);
        if (!user) {
            return ServiceResponse.error({ message: USER_MESSAGES.USER_NOT_FOUND, statusCode: 404 });
        }

        const roleInfo = await userRepository.getUserCompanyRole(targetUserId, companyId, roleId);
        if (!roleInfo) {
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 404 });
        }

        const company = await companyRepository.getCompanyById(roleInfo.company_id);
        if (!company) {
            return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
        }

        const fieldsConfig = await userRepository.getUserProfileFieldsConfig(roleInfo.role_id);

        const fields = fieldsConfig
            .filter(config => config.is_active && !config.is_kyc_field && ['user', 'company'].includes(config.source_table))
            .map(config => {
                let value = null;
                if (config.source_table === 'user') {
                    value = user[config.field_name];
                } else if (config.source_table === 'company') {
                    value = company[config.field_name];
                }

                if (value === null || value === undefined) {
                    value = '';
                }

                return {
                    fieldName: config.field_name,
                    label: config.display_name,
                    value,
                    datatype: config.datatype,
                    unit: config.unit,
                    displayOrder: config.display_order
                };
            });

        return ServiceResponse.success({
            message: USER_MESSAGES.ROLE_DETAILS_SUCCESS,
            data: {
                userId: user.id,
                roleId: roleInfo.role_id,
                roleName: roleInfo.role_name,
                roleCode: roleInfo.role_code,
                fields
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.ROLE_DETAILS_FAILED, statusCode: 500 });
    }
};

const getRoleSwitchUserDetails = async ({ companyId, userId, roleId }) => {
    try {
        const roleInfo = await userRepository.getUserCompanyRole(userId, companyId, roleId);
        if (!roleInfo) {
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 404 });
        }

        return await getUserProfile({ companyId, userId, roleId });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_MESSAGES.ROLE_DETAILS_FAILED, statusCode: 500 });
    }
};

module.exports = { createUserProfile, getUserList, getSwitchedRoleUsers, searchUsers, getUserKycDocs, getUserProfile, getViewedUserProfile, updateUserProfile, getUserRoleDetails, getRoleSwitchUserDetails };
