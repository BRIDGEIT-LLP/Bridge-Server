'use strict';
const { Company, CompanyUserRole, CompanyRoleMaster, User } = require('../models');
const { sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { KYC_STATUS } = require('../utils/constant');

const findByEmail = async (email) => {
    return await Company.findOne({
        where: { company_email: email }
    });
};

const getCompanyUser = async (companyId) => {
    return await sequelize.query(
        `SELECT u.*
         FROM "user" u
         JOIN company c
           ON u.company_email = c.company_email
         WHERE c.id = :companyId`,
        {
            replacements: { companyId },
            type: QueryTypes.SELECT
        }
    );
};

const findCompanyWithRoleByEmail = async (email) => {
    return await Company.findOne({
        where: { company_email: email, is_deleted: false },
        include: [{
            model: CompanyUserRole,
            as: 'companyUserRoles',
            include: [
                { model: CompanyRoleMaster, as: 'role' },
                { model: User, as: 'user' }
            ]
        }]
    });
};

// const findByPhoneNumber = async (phoneNumber) => {
//     return await Company.findOne({
//         where: { mobile_number: phoneNumber }
//     });
// };

const findRoleMasterByCode = async (roleCode) => {
    return await CompanyRoleMaster.findOne({
        where: { role_code: roleCode.toUpperCase() }
    });
};

const createCompany = async (companyData, { transaction }) => {
    return await Company.create(companyData, { transaction });
};

const createCompanyUserRole = async (companyUserRoleData, { transaction }) => {
    return await CompanyUserRole.create(companyUserRoleData, { transaction });
};

const updateEmailVerifiedStatus = async (company_id, status, { transaction }) => {
    const [, [updatedCompany]] = await Company.update(
        { is_email_verified: status },
        { where: { id: company_id }, transaction, returning: true }
    );
    return updatedCompany;
};

const updatePhoneVerifiedStatus = async (company_id, status, { transaction }) => {
    const [, [updatedCompany]] = await Company.update(
        { is_mobile_number_verified: status },
        { where: { id: company_id }, transaction, returning: true }
    );
    return updatedCompany;
};

const updateKycStatus = async (companyId, { isKycVerified, status, rejectionReason }, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { is_kyc_verified: isKycVerified, kyc_status: status, kyc_rejection_reason: rejectionReason ?? null, is_kyc_verified: status === 'Approved' },
        { where: { id: companyId }, transaction, returning: true }
    );
    return updatedCompany;
};

const markKycUploaded = async (companyId, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { is_kyc_uploaded: true },
        { where: { id: companyId }, transaction, returning: true }
    );
    return updatedCompany;
};

const getCompanyById = async (companyId) => {
    return await Company.findOne({
        where: { id: companyId, is_deleted: false }
    });
};

const getDefaultCompanyIdByUserId = async (userId) => {
    const companyUserRole = await CompanyUserRole.findOne({
        where: { user_id: userId, is_default_role: true, is_deleted: false }
    });
    return companyUserRole?.company_id ?? null;
};

const updatePasswordByEmail = async (email, hashedPassword, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { password: hashedPassword },
        { where: { company_email: email, is_deleted: false }, transaction, returning: true }
    );
    return updatedCompany;
};

const incrementFailedLoginAttempts = async (companyId, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { failed_login_attempts: sequelize.literal('failed_login_attempts + 1') },
        { where: { id: companyId }, transaction, returning: true }
    );
    return updatedCompany;
};

const lockCompanyLogin = async (companyId, lockedUntil, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { locked_until: lockedUntil },
        { where: { id: companyId }, transaction, returning: true }
    );
    return updatedCompany;
};

const resetFailedLoginAttempts = async (companyId, { transaction } = {}) => {
    const [, [updatedCompany]] = await Company.update(
        { failed_login_attempts: 0, locked_until: null },
        { where: { id: companyId }, transaction, returning: true }
    );
    return updatedCompany;
};

const findCompanyUserRoleById = async (id) => {
    return await CompanyUserRole.findOne({
        where: { id, is_deleted: false, is_default_role: false }
    });
};

const updateCompanyUserRoleStatus = async (id, data, { transaction } = {}) => {
    const [updatedCount, updatedRows] = await CompanyUserRole.update(
        { ...data, updated_at: new Date() },
        { where: { id, is_deleted: false, is_default_role: false }, returning: true, transaction }
    );

    if (updatedCount === 0) {
        return null;
    }

    return updatedRows[0];
};

const markProfileCompleted = async (userId, companyId, roleId, { transaction } = {}) => {
    const [, [updatedRole]] = await CompanyUserRole.update(
        { is_profile_completed: true, updated_at: new Date() },
        {
            where: { user_id: userId, company_id: companyId, role_id: roleId, is_deleted: false },
            returning: true,
            transaction
        }
    );
    return updatedRole;
};

const markDefaultProfileCompleted = async (userId, companyId, { transaction } = {}) => {
    const [, [updatedRole]] = await CompanyUserRole.update(
        { status: KYC_STATUS.APPROVED, is_profile_completed: true, updated_at: new Date() },
        {
            where: { user_id: userId, company_id: companyId, is_default_role: true, is_deleted: false },
            returning: true,
            transaction
        }
    );
    return updatedRole;
};

/**
 * Phone lives on both `user` and `company` (registration copies it to each).
 * Profile updates must keep them in sync — login/OTP read the company row.
 */
const COMPANY_CONTACT_COLUMNS = ['mobile_number', 'country_code'];

const updateCompanyContact = async (companyId, data, { transaction } = {}) => {
    if (!companyId) return null;

    const patch = {};
    for (const col of COMPANY_CONTACT_COLUMNS) {
        if (data?.[col] !== undefined) patch[col] = data[col];
    }
    if (Object.keys(patch).length === 0) return null;

    const [, [updated]] = await Company.update(
        { ...patch, updated_at: new Date() },
        { where: { id: companyId, is_deleted: false }, returning: true, transaction }
    );
    return updated ?? null;
};

/**
 * First-fill GST/CIN on the company row (Investor/Startup → B2B switch).
 * Callers must have already verified the numbers and refused overwrites of
 * values that are already set. Only these columns are copied from `data`.
 */
const COMPANY_IDENTIFIER_COLUMNS = ['gst_number', 'cin_number', 'is_gst_verified', 'is_cin_verified'];

const updateCompanyIdentifiers = async (companyId, data, { transaction } = {}) => {
    if (!companyId) return null;

    const patch = {};
    for (const col of COMPANY_IDENTIFIER_COLUMNS) {
        if (data?.[col] !== undefined) patch[col] = data[col];
    }
    if (Object.keys(patch).length === 0) return null;

    const [, [updated]] = await Company.update(
        { ...patch, updated_at: new Date() },
        { where: { id: companyId, is_deleted: false }, returning: true, transaction }
    );
    return updated ?? null;
};

module.exports = {
    findByEmail,
    findCompanyWithRoleByEmail,
    findRoleMasterByCode,
    createCompany,
    createCompanyUserRole,
    updateEmailVerifiedStatus,
    updatePhoneVerifiedStatus,
    updateKycStatus,
    getCompanyById,
    updatePasswordByEmail,
    getCompanyUser,
    getDefaultCompanyIdByUserId,
    findCompanyUserRoleById,
    updateCompanyUserRoleStatus,
    markProfileCompleted,
    markDefaultProfileCompleted,
    markKycUploaded,
    updateCompanyContact,
    updateCompanyIdentifiers,
    incrementFailedLoginAttempts,
    lockCompanyLogin,
    resetFailedLoginAttempts
};
