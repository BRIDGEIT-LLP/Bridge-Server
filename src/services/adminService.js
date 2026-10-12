'use strict';
const bcrypt = require('bcrypt');
const adminRepository = require('../repositories/adminRepository');
const userRepository = require('../repositories/userRepository');
const userLimitConfigRepository = require('../repositories/userLimitConfigRepository');
const companyRepository = require('../repositories/companyRepository');
const subscriptionRepository = require('../repositories/subscriptionRepository');
const userSuspensionHistoryRepository = require('../repositories/userSuspensionHistoryRepository');
const suspensionCacheRepository = require('../repositories/suspensionCacheRepository');
const userSessionRepository = require('../repositories/userSessionRepository');
const sessionCacheRepository = require('../repositories/sessionCacheRepository');
const { generateAccessToken } = require('../utils/token');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const {
    ADMIN_MESSAGES, USER_LIMIT_CONFIG_MESSAGES, USER_LIMIT_DEFAULTS, USER_TYPES,
    ADMIN_ROLES_CODE, ADMIN_USER_TYPES, TOKEN_TYPES, USER_SUSPENSION_MESSAGES,
    ADMIN_PROFILE_MESSAGES, ROLE_SWITCH_MESSAGES, KYC_STATUS, USER_MESSAGES,
    ADMIN_USER_DETAIL_MESSAGES 
} = require('../utils/constant');
const { maskPhone, maskEmail } = require('../utils/Helper');
const { v4: uuidv4 } = require('uuid');
const { sequelize } = require('../models');

const login = async (email, password) => {
    try {
        const admin = await adminRepository.findByEmail(email);
        if (!admin) {
            return ServiceResponse.error({ message: ADMIN_MESSAGES.INVALID_CREDENTIALS, statusCode: 401 });
        }

        const isPasswordValid = await bcrypt.compare(password, admin.password);
        if (!isPasswordValid) {
            return ServiceResponse.error({ message: ADMIN_MESSAGES.INVALID_CREDENTIALS, statusCode: 401 });
        }

        const userType = USER_TYPES[admin.role];
        if (!userType) {
            errorLogger.error(`Admin login blocked: unmapped role "${admin.role}" for admin id ${admin.id}`);
            return ServiceResponse.error({ message: ADMIN_MESSAGES.LOGIN_FAILED, statusCode: 500 });
        }

        const jti = uuidv4();
        const payload = {
            jti,
            adminId: admin.id,
            email: admin.email,
            mobileNumber: admin.mobile_number,
            role: admin.role,
            userType
        };

        const mfaToken = generateAccessToken(payload, TOKEN_TYPES.MFA_ACCESS_TOKEN);

        const maskedMobile = maskPhone(admin.country_code + admin.mobile_number);
        const maskedEmail = maskEmail(admin.email);

        return ServiceResponse.success({
            message: ADMIN_MESSAGES.LOGIN_SUCCESS,
            data: { mfaToken: mfaToken, role: admin.role, maskedMobile, maskedEmail },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: ADMIN_MESSAGES.LOGIN_FAILED, statusCode: 500 });
    }
};

const findByEmail = async (email) => {
    try {
        const admin = await adminRepository.findByEmail(email);
        return ServiceResponse.success({ data: admin });
    } catch (error) {
        return ServiceResponse.error({ message: 'Error occured while checking email.', data: [], statusCode: 500 });
    }
};

// ── Admin Self-Service Profile ────────────────────────────────────────────────

/**
 * Return the signed-in admin's own profile as a structured field list.
 *
 * The response mirrors the user GET /profile shape (array of ProfileField objects)
 * so the frontend profile page can reuse the same rendering logic for all roles.
 *
 * Fields:
 *   name          — editable (admin can update their display name)
 *   email         — read-only (identity anchor, never changed here)
 *   role          — read-only (role changes go through admin management)
 *   country_code  — editable (folded into the phone widget on the frontend)
 *   mobile_number — editable
 */
const getAdminProfile = async (adminId) => {
    try {
        const admin = await adminRepository.findAdminById(adminId);
        if (!admin) {
            return ServiceResponse.error({
                message: ADMIN_PROFILE_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        const adminData = admin.toJSON ? admin.toJSON() : admin;

        const fields = [
            {
                label: 'Name',
                columnName: 'name',
                value: adminData.name || '',
                isEditable: true,
                type: 'string'
            },
            {
                label: 'Email',
                columnName: 'email',
                value: adminData.email || '',
                isEditable: false,
                type: 'email'
            },
            {
                label: 'Role',
                columnName: 'role',
                value: adminData.role || '',
                isEditable: false,
                type: 'string'
            },
            {
                label: 'Country Code',
                columnName: 'country_code',
                value: adminData.country_code || '',
                isEditable: true,
                type: 'string'
            },
            {
                label: 'Mobile Number',
                columnName: 'mobile_number',
                value: adminData.mobile_number || '',
                isEditable: true,
                type: 'string'
            }
        ];

        return ServiceResponse.success({
            message: ADMIN_PROFILE_MESSAGES.FETCH_SUCCESS,
            data: fields,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_PROFILE_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

/**
 * Update the signed-in admin's own editable profile fields.
 *
 * Only name, country_code, and mobile_number may be changed here.
 * Email and role are immutable through this endpoint.
 * At least one field must be supplied (enforced by Joi in the controller).
 */
const updateAdminProfile = async (adminId, payload) => {
    try {
        const admin = await adminRepository.findAdminById(adminId);
        if (!admin) {
            return ServiceResponse.error({
                message: ADMIN_PROFILE_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        const { name, country_code, mobile_number } = payload;

        const updateData = { updated_by: adminId, updated_at: new Date() };
        if (name !== undefined) updateData.name = name;
        if (country_code !== undefined) updateData.country_code = country_code;
        if (mobile_number !== undefined) updateData.mobile_number = mobile_number;

        await adminRepository.updateAdminById(adminId, updateData);

        return ServiceResponse.success({
            message: ADMIN_PROFILE_MESSAGES.UPDATE_SUCCESS,
            data: [],
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: ADMIN_PROFILE_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

// ── User Limit Config ─────────────────────────────────────────────────────────

const getUserLimitConfig = async ({ userId, userType }) => {
    try {
        if (!ADMIN_USER_TYPES.includes(userType)) {
            return ServiceResponse.error({
                message: USER_LIMIT_CONFIG_MESSAGES.FORBIDDEN,
                statusCode: 403
            });
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            return ServiceResponse.error({
                message: USER_LIMIT_CONFIG_MESSAGES.USER_NOT_FOUND,
                statusCode: 404
            });
        }

        const config = await userLimitConfigRepository.findByUserId(userId);

        const companyId = await companyRepository.getDefaultCompanyIdByUserId(userId);
        const subscription = companyId
            ? await subscriptionRepository.getActiveSubscription(userId, companyId)
            : null;

        const hasSubscription = !!subscription;
        const isSubscriptionExpired = hasSubscription
            ? new Date(subscription.end_date) < new Date()
            : false;

        let data = {};

        if (hasSubscription && !isSubscriptionExpired) {
            data = {
                user_id: userId,
                allowed_premium_days: config?.allowed_premium_days ?? subscription.validity_days,
                is_custom: !!config?.updated_by,
                has_subscription: hasSubscription,
                is_subscription_expired: isSubscriptionExpired
            };
        }
        else {
            data = {
                user_id: userId,
                allowed_connections: config?.allowed_connections,
                allowed_free_trial_days: config?.allowed_free_trial_days,
                is_custom: !!config?.updated_by,
                has_subscription: hasSubscription
            };
        }

        return ServiceResponse.success({
            message: USER_LIMIT_CONFIG_MESSAGES.FETCH_SUCCESS,
            data,
            statusCode: 200
        });

    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: USER_LIMIT_CONFIG_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

const updateUserLimitConfig = async ({ userId, adminId, userType, payload }) => {
    const transaction = await sequelize.transaction();
    try {
        if (!ADMIN_USER_TYPES.includes(userType)) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: USER_LIMIT_CONFIG_MESSAGES.FORBIDDEN,
                statusCode: 403
            });
        }

        const user = await userRepository.getUserById(userId);
        if (!user) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: USER_LIMIT_CONFIG_MESSAGES.USER_NOT_FOUND,
                statusCode: 404
            });
        }

        const { allowed_connections, allowed_free_trial_days, allowed_premium_days } = payload;

        const updateData = {};
        if (allowed_connections !== undefined) updateData.allowed_connections = allowed_connections;
        if (allowed_free_trial_days !== undefined) updateData.allowed_free_trial_days = allowed_free_trial_days;
        if (allowed_premium_days !== undefined) updateData.allowed_premium_days = allowed_premium_days;

        const result = await userLimitConfigRepository.upsertUserLimitConfig(userId, updateData, adminId, { transaction });

        await transaction.commit();

        return ServiceResponse.success({
            message: USER_LIMIT_CONFIG_MESSAGES.UPDATE_SUCCESS,
            data: result,
            statusCode: 200
        });

    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: USER_LIMIT_CONFIG_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

// ── User Detail (View Profile) ────────────────────────────────────────────────

/**
 * One user's role-shaped profile fields (via user_profile_field_master, same source as
 * the user-facing role-details endpoint) plus their latest suspension/reactivation
 * reason (from user_suspension_history), for the admin "View Profile" drawer.
 *
 * companyId + roleCode are required rather than resolved from a "default role" —
 * the frontend list row already carries both, mirroring how getRoleSwitchUserDetails
 * requires an explicit companyId/roleId.
 */
const getUserDetail = async ({ userId, companyId, roleCode }) => {
    try {
        const user = await userRepository.getUserById(userId);
        if (!user) {
            return ServiceResponse.error({ message: USER_MESSAGES.USER_NOT_FOUND, statusCode: 404 });
        }

        const roleInfo = await userRepository.getUserCompanyRoleByCode(userId, companyId, roleCode);
        if (!roleInfo) {
            return ServiceResponse.error({ message: USER_MESSAGES.ROLE_NOT_FOUND, statusCode: 404 });
        }

        const [company, fieldsConfig, suspensionHistory] = await Promise.all([
            companyRepository.getCompanyById(companyId),
            userRepository.getUserProfileFieldsConfig(roleInfo.role_id),
            userSuspensionHistoryRepository.findAllByUserId(userId)
        ]);
        const latestSuspension = suspensionHistory[0] ?? null;

        if (!company) {
            return ServiceResponse.error({ message: 'Company not found.', statusCode: 404 });
        }

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

        const suspension = {
            isSuspended: user.is_user_suspended,
            lastAction: latestSuspension ? (latestSuspension.is_suspended ? 'suspended' : 'reactivated') : null,
            reason: latestSuspension?.suspension_reason ?? null,
            actionBy: latestSuspension?.created_by ?? null,
            actionAt: latestSuspension?.created_at ?? null,
            isLockedBySuperAdmin: latestSuspension?.is_updated_by_super_admin ?? false
        };

        const suspensionHistoryList = suspensionHistory.map(entry => ({
            isSuspended: entry.is_suspended,
            lastAction: entry.is_suspended ? 'suspended' : 'reactivated',
            reason: entry.suspension_reason ?? null,
            actionBy: entry.created_by ?? null,
            actionAt: entry.created_at,
            isLockedBySuperAdmin: entry.is_updated_by_super_admin
        }));

        return ServiceResponse.success({
            message: ADMIN_USER_DETAIL_MESSAGES.FETCH_SUCCESS,
            data: {
                userId: user.id,
                firstName: user.first_name,
                lastName: user.last_name,
                profilePhoto: user.profile_photo,
                companyId: company.id,
                companyName: company.company_name,
                email: company.company_email,
                countryCode: company.country_code,
                mobileNumber: company.mobile_number,
                emailVerified: company.is_email_verified,
                mobileVerified: company.is_mobile_number_verified,
                kycStatus: company.kyc_status,
                isActive: user.is_active,
                roleId: roleInfo.role_id,
                roleName: roleInfo.role_name,
                roleCode: roleInfo.role_code,
                fields,
                suspension,
                suspensionHistory: suspensionHistoryList
            },
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: ADMIN_USER_DETAIL_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const updateUserSuspension = async (userId, companyId, adminId, role, is_suspended, suspension_reason ) => {
    const transaction = await sequelize.transaction();
    try {
        const isUpdatedBySuperAdmin = role === ADMIN_ROLES_CODE.SUPER_ADMIN;

        const latestHistory = await userSuspensionHistoryRepository.findLatestByUserId(userId, { transaction });
        if (latestHistory?.is_updated_by_super_admin && !isUpdatedBySuperAdmin) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: USER_SUSPENSION_MESSAGES.FORBIDDEN_SUPER_ADMIN_LOCK,
                statusCode: 403
            });
        }

        const history = await userSuspensionHistoryRepository.create({
            user_id: userId,
            company_id: companyId,
            is_suspended,
            suspension_reason,
            created_by: adminId,
            is_updated_by_super_admin: isUpdatedBySuperAdmin
        }, { transaction });

        await userRepository.updateUser(
            { is_user_suspended: is_suspended },
            userId,
            { transaction, allowPrivileged: true }
        );

        // Suspension must kill every existing session immediately, otherwise
        // a token issued before the suspension keeps passing authMiddleware's
        // jti check until it naturally expires.
        if (is_suspended) {
            await userSessionRepository.revokeAllSessionsByUser(userId, { transaction });
        }

        await transaction.commit();

        // Keep the Redis suspension cache in sync so authMiddleware's
        // per-request suspension check reflects this change on the very
        // next authenticated request, without waiting for the next app
        // restart. Best-effort: Postgres already committed and is the
        // source of truth, so a Redis hiccup here must not fail the
        // admin's request — worst case it self-heals on the
        // next startup load.
        if (is_suspended) {
            await suspensionCacheRepository.cacheSuspension(userId, {
                reason: suspension_reason,
                companyId,
                suspendedAt: history.created_at
            });
            // Drop the cached active-jti set too, so isSessionJtiValid can't
            // serve a stale VALID from Redis for a session we just revoked.
            await sessionCacheRepository.invalidateUser(userId);
        } else {
            await suspensionCacheRepository.clearSuspension(userId);
        }

        return ServiceResponse.success({
            message: USER_SUSPENSION_MESSAGES.UPDATE_SUCCESS,
            data: history,
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({ message: USER_SUSPENSION_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

const updateRoleSwitchStatus = async ({ companyUserRoleId, action, rejectionReason, adminId }) => {
    try {
        const companyUserRole = await companyRepository.findCompanyUserRoleById(companyUserRoleId);
        if (!companyUserRole) {
            return ServiceResponse.error({ message: ROLE_SWITCH_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        // Approve/reject is a review of the completed target-role profile. Acting
        // before that would also have previously stamped is_profile_completed on
        // approve, which hid incomplete profiles as if the user had filled them.
        if (!companyUserRole.is_profile_completed) {
            return ServiceResponse.error({ message: ROLE_SWITCH_MESSAGES.PROFILE_NOT_COMPLETED, statusCode: 400 });
        }

        const status = action === 'approve' ? KYC_STATUS.APPROVED : KYC_STATUS.REJECTED;
        const reason = action === 'reject' ? (rejectionReason ?? null) : null;

        const updated = await companyRepository.updateCompanyUserRoleStatus(companyUserRoleId, {
            status,
            rejection_reason: reason,
            approved_by: adminId,
            approved_at: new Date(),
            updated_by: adminId
        });

        if (!updated) {
            return ServiceResponse.error({ message: ROLE_SWITCH_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        return ServiceResponse.success({ message: ROLE_SWITCH_MESSAGES.REVIEW_ACTION_SUCCESS, data: updated, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: ROLE_SWITCH_MESSAGES.REVIEW_ACTION_FAILED, statusCode: 500 });
    }
};

module.exports = {
    login, findByEmail, getAdminProfile, updateAdminProfile, getUserLimitConfig,
    updateUserLimitConfig, getUserDetail, updateUserSuspension, updateRoleSwitchStatus, getMatchingEngineStats
};


// ─── Matching Engine Dashboard ─────────────────────────────────────────────────

/**
 * Aggregate KPIs for the Matching Engine Dashboard.
 * All DB queries are delegated to adminRepository — this layer only handles
 * business logic (rate calculation, normalization) and error propagation.
 */
async function getMatchingEngineStats() {
    try {
        // Run all queries in parallel for performance
        const [
            kpi,
            breakdownRows,
            zeroRows,
            matchVolume,
            avgScoreRow,
            topSectors,
            algorithmDist,
            behavioralSignals,
        ] = await Promise.all([
            adminRepository.getMatchingEngineKpis(),
            adminRepository.getConnectionStatusBreakdown(),
            adminRepository.getZeroEngagementProfiles(),
            adminRepository.getMatchesGenerated(),
            adminRepository.getAverageCompatibilityScore(),
            adminRepository.getTopSectorsByVolume(),
            adminRepository.getAlgorithmDistribution(),
            adminRepository.getBehavioralSignals(),
        ]);

        const totalConnections    = parseInt(kpi.total_connections)    || 0;
        const acceptedConnections = parseInt(kpi.accepted_connections)  || 0;
        const acceptanceRate = totalConnections > 0
            ? Math.round((acceptedConnections / totalConnections) * 1000) / 10
            : 0;

        // Algorithm distribution with percentage (for cold-start vs. ML ratio)
        const totalAlgoShown = algorithmDist.reduce((s, r) => s + (parseInt(r.count) || 0), 0);
        const algorithmDistribution = algorithmDist.map(r => ({
            algorithmType: r.algorithm_type,
            count:         parseInt(r.count) || 0,
            percentage:    totalAlgoShown > 0
                ? Math.round((parseInt(r.count) / totalAlgoShown) * 100)
                : 0,
        }));

        return ServiceResponse.success({
            message: 'Matching engine stats fetched successfully.',
            data: {
                // ── Existing metrics (from connection/deal_room/user tables) ──
                totalProfiles:         parseInt(kpi.total_profiles)    || 0,
                totalConnections,
                acceptedConnections,
                acceptanceRate,
                activeDealRooms:       parseInt(kpi.active_deal_rooms) || 0,
                connectionStatusBreakdown: breakdownRows.map(r => ({
                    status: r.status,
                    count:  parseInt(r.count) || 0,
                })),
                zeroEngagementProfiles: zeroRows.map(r => ({
                    userId:   String(r.user_id),
                    name:     [r.first_name, r.last_name].filter(Boolean).join(' ').trim() || '—',
                    role:     r.role_code    || '—',
                    company:  r.company_name || '—',
                    profilePhoto: r.profile_photo ?? null,
                    joinedAt: r.created_at
                        ? (r.created_at.toISOString?.() ?? String(r.created_at))
                        : null,
                })),

                // ── FRD Module 12.3 — new metrics from matching_events table ──
                /** Total matches generated: today / this week / this month */
                matchesGenerated: {
                    today:     parseInt(matchVolume.today)      || 0,
                    thisWeek:  parseInt(matchVolume.this_week)  || 0,
                    thisMonth: parseInt(matchVolume.this_month) || 0,
                },
                /** Average compatibility score (null = no data yet) */
                avgCompatibilityScore: avgScoreRow.avg_score != null
                    ? parseFloat(avgScoreRow.avg_score) || 0
                    : null,
                /** Top 5 sectors by match volume */
                topSectorsByVolume: topSectors.map(r => ({
                    sector: r.sector,
                    count:  parseInt(r.count) || 0,
                })),
                /** Cold-start (rule_based) vs. ML model distribution */
                algorithmDistribution,
                /** Behavioural signals: skips, accepts, flags etc. */
                behavioralSignals: behavioralSignals.map(r => ({
                    action: r.action,
                    count:  parseInt(r.count) || 0,
                })),
            },
            statusCode: 200,
        });

    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: 'Error fetching matching engine stats.',
            statusCode: 500,
        });
    }
}
