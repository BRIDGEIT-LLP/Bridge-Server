'use strict';
const bcrypt = require('bcrypt');
const { UniqueConstraintError } = require('sequelize');
const { sequelize } = require('../models');
const companyRepository = require('../repositories/companyRepository');
const userRepository = require('../repositories/userRepository');
const tokenService = require('./tokenService');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { hashPassword } = require('../utils/Helper');
const { REGISTRATION_MESSAGES, AUTH_MESSAGES, USER_MESSAGES, KYC_STATUS, LOGIN_LOCKOUT_LIMITS, ROLE_SWITCH_MESSAGES } = require('../utils/constant');


const getCompanyByEmail = async (email) => {
    try {
        const existingEmailUser = await companyRepository.findByEmail(email);
        return ServiceResponse.success({data:existingEmailUser});
    }
    catch (error) {
    console.error('getUserByEmail ERROR:', error);

    return ServiceResponse.error({
        message:'Error occured while checking company email.',
        data:[error.message],
        statusCode:500
    });
}
}

const getUserByEmail = async (email) => {
    try {
        const existingEmailUser = await userRepository.findByEmail(email);
        return ServiceResponse.success({data:existingEmailUser});
    }
    catch (error) {
    console.error('getUserByEmail ERROR:', error);

    return ServiceResponse.error({
        message:'Error occured while checking user email.',
        data:[error.message],
        statusCode:500
    });
}
}


const createCompany = async (data) => {
    const transaction = await sequelize.transaction();
    // console.log("createCompany data: ", data);
    try {
        // TODO:- encyption add
        // TODO:- need to remove termsAccepted
        const companyData = {
            company_name: data.companyName,
            company_email: data.email, 
            country_code: data.countryCode,
            mobile_number: data.phoneNumber,
            password: await hashPassword(data.password),
            gst_number: data?.gstNumber,
            cin_number: data?.cinNumber,
            is_gst_verified: data?.isGstVerified === true,
            is_cin_verified: data?.isCinVerified === true,
            terms_accepted: data.termsAccepted,
            is_email_verified: false,
            is_mobile_number_verified: false,
            created_at: new Date(),
        };
        // TODO: consistant mobile and email id variables
        const company = await companyRepository.createCompany(companyData, transaction);
        const role = await companyRepository.findRoleMasterByCode(data.role);

        const userData = {
            company_email: data.email,
            password: await hashPassword(data.password),
            mobile_number: data.phoneNumber,
            country_code: data.countryCode,
            created_at: new Date()
        };
        const user = await userRepository.createUser(userData, { transaction });

        await companyRepository.createCompanyUserRole(
            {
                company_id: company.id,
                role_id: role.id,
                user_id: user.id,
                is_default_role: true,
                status: KYC_STATUS.PENDING
            },
            { transaction }
        );
        await transaction.commit();

        return ServiceResponse.success({message: REGISTRATION_MESSAGES.REGISTRATION_SUCCESS, data: { company, role, user }, statusCode: 201});
    }
    catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({message: REGISTRATION_MESSAGES.COMPANY_CREATION_FAILED, data: [], statusCode: 500});
    }
};


/**
 * Verifies channel OTP and triggers automatic final registration if both verified.
 * 
 */

// Service to update channel verified Status
const updateChannelVerifiedStatus = async (channel, company_id) => {
    const transaction = await sequelize.transaction();
    try {
        // 1. Update the respective channel verified status in company table
        let updatedCompany;
        if (channel === 'EMAIL') {
            updatedCompany = await companyRepository.updateEmailVerifiedStatus(company_id, true, {transaction});
        } else if (channel === 'PHONE') {
            updatedCompany = await companyRepository.updatePhoneVerifiedStatus(company_id, true, {transaction});
        } else {
            throw new Error('Invalid channel specified');
        }
        await transaction.commit();
        return ServiceResponse.success({message: 'Channel verification status updated successfully', data: updatedCompany, statusCode: 200});
    } catch (err) {
        await transaction.rollback();
        errorLogger.error(err);
        return ServiceResponse.error({
            message: 'Error encountered.',
            data: []
        });
    }
};


const checkPassword = async (password, hashedPassword) => {
    try {
        const isPasswordValid = await bcrypt.compare(password, hashedPassword);
        if (!isPasswordValid) {
            return ServiceResponse.error({ message: AUTH_MESSAGES.INVALID_CREDENTIALS, statusCode: 401 });
        }
        else {
            return ServiceResponse.success({ statusCode: 200 });
        }
    } catch (error) {
        return ServiceResponse.error({ message: AUTH_MESSAGES.INVALID_CREDENTIALS, statusCode: 401 });
    }
}

const formatLockMessage = (minutes) =>
    `Account locked due to ${LOGIN_LOCKOUT_LIMITS.MAX_FAILED_ATTEMPTS} incorrect password attempts. Please try again after ${minutes} minute${minutes === 1 ? '' : 's'}.`;

// Called on every login attempt before the password is checked. Lazily clears
// a stale lock (locked_until in the past) so the next attempt gets a fresh
// 5-attempt budget instead of re-locking immediately.
const checkLoginLockStatus = async (company) => {
    if (!company.locked_until) {
        return { locked: false };
    }

    const remainingMs = new Date(company.locked_until).getTime() - Date.now();
    if (remainingMs > 0) {
        const remainingMinutes = Math.ceil(remainingMs / 60000);
        return { locked: true, message: formatLockMessage(remainingMinutes) };
    }

    await companyRepository.resetFailedLoginAttempts(company.id);
    return { locked: false };
};

const registerFailedLoginAttempt = async (companyId) => {
    const updated = await companyRepository.incrementFailedLoginAttempts(companyId);

    if (updated.failed_login_attempts < LOGIN_LOCKOUT_LIMITS.MAX_FAILED_ATTEMPTS) {
        return { locked: false };
    }

    const lockedUntil = new Date(Date.now() + LOGIN_LOCKOUT_LIMITS.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await companyRepository.lockCompanyLogin(companyId, lockedUntil);
    return { locked: true, message: formatLockMessage(LOGIN_LOCKOUT_LIMITS.LOCKOUT_DURATION_MINUTES) };
};

const resetLoginAttempts = async (companyId) => {
    await companyRepository.resetFailedLoginAttempts(companyId);
};

const getCompanyUser_role = async (company_id, user_id) => {
    try {
        const result = await userRepository.getCompanyUser_role(company_id, user_id);
        return ServiceResponse.success({data: result[0]})
    } catch (error) {
        errorLogger.error(error);

        return ServiceResponse.error({
            message: error.message,
            statusCode: 500
    });
}
}


const getUserCompanyRoleByCode = async (userId, companyId, roleCode) => {
    try {
        const roleInfo = await userRepository.getUserCompanyRoleByCode(userId, companyId, roleCode);
        return ServiceResponse.success({ data: roleInfo });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: error.message,
            statusCode: 500
        });
    }
};

const toRoleSwitchRow = (companyUserRole, role, companyId) => ({
    company_user_role_id: companyUserRole.id ?? companyUserRole.company_user_role_id,
    role_id: role.id,
    company_id: companyId,
    role_name: role.role_name ?? companyUserRole.role_name,
    role_code: role.role_code ?? companyUserRole.role_code,
    status: companyUserRole.status,
    rejection_reason: companyUserRole.rejection_reason,
    is_profile_completed: companyUserRole.is_profile_completed
});

const allocateUserCompanyRole = async (userId, companyId, roleCode, { isProfileCompleted = false } = {}) => {
    const transaction = await sequelize.transaction();
    try {
        const role = await companyRepository.findRoleMasterByCode(roleCode);
        if (!role) {
            await transaction.rollback();
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 400 });
        }

        const companyUserRole = await companyRepository.createCompanyUserRole(
            {
                company_id: companyId,
                user_id: userId,
                role_id: role.id,
                is_default_role: false,
                is_profile_completed: isProfileCompleted
            },
            { transaction }
        );
        await transaction.commit();

        return ServiceResponse.success({
            data: toRoleSwitchRow(companyUserRole, role, companyId),
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();

        // A concurrent request can win the insert race between the existence
        // check and this insert; the unique index on (user_id, company_id, role_id)
        // turns that into a constraint error instead of a duplicate row.
        if (error instanceof UniqueConstraintError) {
            const existing = await userRepository.getUserCompanyRoleByCode(userId, companyId, roleCode);
            if (existing) {
                if (isProfileCompleted && !existing.is_profile_completed) {
                    const role = await companyRepository.findRoleMasterByCode(roleCode);
                    if (role) {
                        const updated = await companyRepository.markProfileCompleted(userId, companyId, role.id);
                        if (updated) {
                            return ServiceResponse.success({
                                data: toRoleSwitchRow(updated, role, companyId),
                                statusCode: 200
                            });
                        }
                    }
                }
                return ServiceResponse.success({ data: existing, statusCode: 200 });
            }
        }

        errorLogger.error(error);
        return ServiceResponse.error({ message: error.message, statusCode: 500 });
    }
};

const getCompanyAndUser = async (companyId, userId) => {
    try {
        const [company, user] = await Promise.all([
            companyRepository.getCompanyById(companyId),
            userRepository.getUserById(userId)
        ]);
        return ServiceResponse.success({ data: { company, user } });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: error.message, statusCode: 500 });
    }
};

/**
 * Fetches user_profile_field_master's field list for a role.
 */
const getProfileFieldsConfig = async (roleId) => {
    try {
        const fieldsConfig = await userRepository.getUserProfileFieldsConfig(roleId);
        return ServiceResponse.success({ data: fieldsConfig });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: error.message, statusCode: 500 });
    }
};

/**
 * Registration columns for a target role, with the current user/company values.
 * Empty arrays (and founder placeholder rows) are "not filled" — otherwise
 * jsonb `founders: []` would skip the switch-role form even though Startup
 * still requires at least one name + LinkedIn URL.
 */
const isProfileValueFilled = (value) => {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) {
        if (value.length === 0) return false;
        return value.some((row) => {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
                return String(row.name ?? '').trim() !== '' || String(row.url ?? '').trim() !== '';
            }
            return row !== null && row !== undefined && row !== '';
        });
    }
    return true;
};

const listSwitchRoleFields = (fieldsConfig, user, company) => {
    // One row per column. Company + user both list email/phone — keep `user`
    // so the switch-role save can write it.
    const byName = new Map();
    for (const raw of fieldsConfig || []) {
        const config = typeof raw.get === 'function' ? raw.get({ plain: true }) : raw;
        if (config.is_registration_field === false) continue;
        if (config.source_table !== 'user' && config.source_table !== 'company') continue;
        const existing = byName.get(config.field_name);
        if (existing && existing.source_table === 'user' && config.source_table !== 'user') continue;
        byName.set(config.field_name, config);
    }

    const fields = [];
    for (const config of byName.values()) {
        const value = config.source_table === 'user'
            ? user?.[config.field_name]
            : company?.[config.field_name];
        fields.push({
            fieldName: config.field_name,
            label: config.display_name,
            sourceTable: config.source_table,
            type: config.type,
            isEditable: config.is_editable,
            isRequired: Boolean(config.is_required),
            isFilled: isProfileValueFilled(value),
            value: value ?? null
        });
    }
    return fields;
};

/**
 * Fails only when an is_required registration field has no value yet; optional
 * blanks ride along on that response so they can be filled, but they do not
 * block submitting the role-switch request.
 */
const validateAvailableProfileFields = (fieldsConfig, user, company) => {
    const fields = listSwitchRoleFields(fieldsConfig, user, company);
    const missingFields = fields.filter((field) => !field.isFilled);

    if (missingFields.some((field) => field.isRequired)) {
        return ServiceResponse.error({
            message: USER_MESSAGES.PROFILE_NOT_COMPLETED,
            data: { missingFields },
            statusCode: 400
        });
    }

    return ServiceResponse.success({});
};

/**
 * Read-only preview of the target role's registration fields. Does not insert
 * into company_user_role — that happens only when the user submits
 * request-role-switch after filling required fields.
 */
const getSwitchRoleDetails = async (userId, companyId, roleCode) => {
    try {
        const role = await companyRepository.findRoleMasterByCode(roleCode);
        if (!role) {
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 400 });
        }

        const existing = await userRepository.getUserCompanyRoleByCode(userId, companyId, roleCode);
        const companyUserRes = await getCompanyAndUser(companyId, userId);
        if (!companyUserRes.success) {
            return companyUserRes;
        }
        const { company, user } = companyUserRes.data;

        const fieldsConfigRes = await getProfileFieldsConfig(role.id);
        if (!fieldsConfigRes.success) {
            return fieldsConfigRes;
        }

        return ServiceResponse.success({
            message: ROLE_SWITCH_MESSAGES.DETAILS_SUCCESS,
            data: {
                roleId: role.id,
                roleCode: role.role_code,
                status: existing?.status ?? null,
                isProfileCompleted: existing ? Boolean(existing.is_profile_completed) : false,
                rejectionReason: existing?.rejection_reason ?? null,
                fields: listSwitchRoleFields(fieldsConfigRes.data, user, company)
            }
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ROLE_SWITCH_MESSAGES.DETAILS_FAILED,
            statusCode: 500
        });
    }
};

/**
 * After the target-role profile is saved, create (or complete) the
 * company_user_role row with is_profile_completed=true and status Pending so
 * an admin can approve or reject it. Never issues a new token pair.
 */
const submitRoleSwitchRequest = async (userId, companyId, roleCode) => {
    try {
        const role = await companyRepository.findRoleMasterByCode(roleCode);
        if (!role) {
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 400 });
        }

        const companyUserRes = await getCompanyAndUser(companyId, userId);
        if (!companyUserRes.success) {
            return companyUserRes;
        }
        const { company, user } = companyUserRes.data;

        const fieldsConfigRes = await getProfileFieldsConfig(role.id);
        if (!fieldsConfigRes.success) {
            return fieldsConfigRes;
        }

        const profileFieldsRes = validateAvailableProfileFields(fieldsConfigRes.data, user, company);
        if (!profileFieldsRes.success) {
            return profileFieldsRes;
        }

        const existing = await userRepository.getUserCompanyRoleByCode(userId, companyId, roleCode);
        if (existing?.is_profile_completed) {
            return ServiceResponse.success({
                message: USER_MESSAGES.PROFILE_PENDING_APPROVAL,
                data: {
                    status: existing.status,
                    isProfileCompleted: true
                }
            });
        }

        if (existing) {
            const updated = await companyRepository.markProfileCompleted(userId, companyId, role.id);
            return ServiceResponse.success({
                message: ROLE_SWITCH_MESSAGES.REQUEST_SUCCESS,
                data: {
                    status: updated?.status ?? existing.status ?? KYC_STATUS.PENDING,
                    isProfileCompleted: true
                }
            });
        }

        const allocateRes = await allocateUserCompanyRole(userId, companyId, roleCode, {
            isProfileCompleted: true
        });
        if (!allocateRes.success) {
            return allocateRes;
        }

        return ServiceResponse.success({
            message: ROLE_SWITCH_MESSAGES.REQUEST_SUCCESS,
            data: {
                status: allocateRes.data?.status ?? KYC_STATUS.PENDING,
                isProfileCompleted: true
            },
            statusCode: allocateRes.statusCode
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ROLE_SWITCH_MESSAGES.REQUEST_FAILED,
            statusCode: 500
        });
    }
};

const resetPassword = async (email, newPassword) => {
    const transaction = await sequelize.transaction();
    try {
        const hashedPassword = await hashPassword(newPassword);

        const updatedCompany = await companyRepository.updatePasswordByEmail(email, hashedPassword, { transaction });
        await userRepository.updatePasswordByEmail(email, hashedPassword, { transaction });

        // A locked-out user who proves their identity via OTP-verified reset
        // should not still be blocked by the old lockout when they log back in.
        if (updatedCompany) {
            await companyRepository.resetFailedLoginAttempts(updatedCompany.id, { transaction });
        }

        await transaction.commit();
        return ServiceResponse.success({ message: AUTH_MESSAGES.PASSWORD_RESET_SUCCESS, statusCode: 200 });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: AUTH_MESSAGES.PASSWORD_RESET_FAILED, statusCode: 500 });
    }
};

module.exports = {
    checkPassword,
    createCompany,
    updateChannelVerifiedStatus,
    getCompanyByEmail,
    getUserByEmail,
    getCompanyUser_role,
    getUserCompanyRoleByCode,
    allocateUserCompanyRole,
    getCompanyAndUser,
    getProfileFieldsConfig,
    listSwitchRoleFields,
    validateAvailableProfileFields,
    getSwitchRoleDetails,
    submitRoleSwitchRequest,
    resetPassword,
    checkLoginLockStatus,
    registerFailedLoginAttempt,
    resetLoginAttempts
};
