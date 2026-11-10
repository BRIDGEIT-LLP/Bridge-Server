'use strict';

const dashboardRepository = require('../repositories/dashboardRepository');
const matchingService = require('../matching/matchingService');
const connectionService = require('./connectionService');
const dealRoomService = require('./dealRoomService');
const adminConfigService = require('./adminConfigService');
const userRepository = require('../repositories/userRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { DASHBOARD_MESSAGES, CONNECTION_STATUS, TRIAL_CONFIG_LOOKUP_KEYS, TRIAL_DAYS_LIMITS } = require('../utils/constant');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Days left in the free Discovery trial, counted from signup (user.created_at).
// Only meaningful for non-subscribers — callers should skip this for members.
const getTrialDaysRemaining = async (userId) => {
    const [user, trialDayLimit] = await Promise.all([
        userRepository.getUserById(userId),
        adminConfigService.getTrialConfigValue(TRIAL_CONFIG_LOOKUP_KEYS.FREE_TRIAL_DAY, TRIAL_DAYS_LIMITS.FREE),
    ]);
    const signupAt = user?.created_at ? new Date(user.created_at) : null;
    if (!signupAt || Number.isNaN(signupAt.getTime())) {
        return Number(trialDayLimit) || 0;
    }
    const daysElapsed = Math.floor((Date.now() - signupAt.getTime()) / MS_PER_DAY);
    return Math.max((Number(trialDayLimit) || 0) - daysElapsed, 0);
};

const TOP_INTRODUCTIONS_LIMIT = 3;
const REQUESTS_FOR_YOU_LIMIT = 5;
const DEAL_ROOMS_PANEL_LIMIT = 5;

// Vouch/Referral has no backing model yet (per product decision) — this returns
// static placeholder data so the Home widget has something to render until the
// real referral feature (FRD §3.7) is built.
const getDummyVouchData = () => ({
    vouchCode: 'BRIDGE-VOUCH-DEMO',
    totalVouched: 4,
    pendingInvites: 2,
    freeMonthsEarned: 1,
    recentVouches: [
        { name: 'Aditi Rao', organizationName: 'Northwind Foods', status: 'Joined' },
        { name: 'Rahul Mehta', organizationName: 'Orbit Logistics', status: 'Invited' },
    ],
});

// ─── User Dashboard ───────────────────────────────────────────────────────────

const getUserDashboard = async ({ userId }) => {
    try {
        const [
            profile,
            connectionStats,
            activeDealRoomsCount,
            kycDocumentsCount,
            upcomingMeetingsCount,
        ] = await Promise.all([
            dashboardRepository.getUserDashboardProfile(userId)
                .catch((err) => { errorLogger.error(err); return null; }),
            dashboardRepository.getUserConnectionStats(userId)
                .catch((err) => { errorLogger.error(err); return {}; }),
            dashboardRepository.getUserActiveDealRoomsCount(userId)
                .catch((err) => { errorLogger.error(err); return 0; }),
            dashboardRepository.getUserKycDocumentsCount(userId)
                .catch((err) => { errorLogger.error(err); return 0; }),
            // Meeting table shape is assumed rather than verified — silent fallback
            // is intentional here so a schema mismatch doesn't fail the whole dashboard.
            dashboardRepository.getUserUpcomingMeetingsCount(userId)
                .catch(() => 0),
        ]);

        if (!profile) {
            return ServiceResponse.error({ message: DASHBOARD_MESSAGES.USER_NOT_FOUND, statusCode: 404 });
        }

        return ServiceResponse.success({
            message: DASHBOARD_MESSAGES.FETCH_SUCCESS,
            data: {
                profile: {
                    firstName:        profile.first_name,
                    lastName:         profile.last_name,
                    organizationName: profile.organization_name,
                    role:             profile.role_code,
                    isActive:         profile.is_active,
                    kycStatus:        profile.kyc_status,
                },
                stats: {
                    connectionsSent:        parseInt(connectionStats.sent        || 0),
                    connectionsReceived:    parseInt(connectionStats.received    || 0),
                    connectionsAccepted:    parseInt(connectionStats.accepted    || 0),
                    activeDealRooms:        activeDealRoomsCount,
                    kycDocumentsCount:      kycDocumentsCount,
                    upcomingMeetingsCount:  upcomingMeetingsCount,
                    // Placeholder stats — no backing table yet; will be non-zero once
                    // profile_view tracking and watchlist features are implemented.
                    profileViews:   0,
                    watchlistCount: 0,
                },
            },
            statusCode: 200,
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DASHBOARD_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── User Dashboard — Home screen (S10) ──────────────────────────────────────
//
// Aggregates data already computed by the matching/connection/deal-room
// services into one response for the Home screen, instead of the frontend
// firing three+ parallel requests and re-deriving business rules (billing
// window, request caps) itself.

const getUserDashboardHome = async ({ userId, roleId, role }) => {
    try {
        const [matchesResult, receivedResult, dealRoomsResult] = await Promise.all([
            matchingService.getMatches(userId, role)
                .catch((err) => { errorLogger.error(err); return null; }),
            connectionService.getReceivedConnections(userId, roleId)
                .catch((err) => { errorLogger.error(err); return null; }),
            dealRoomService.getDealRooms(userId, roleId, { archived: false })
                .catch((err) => { errorLogger.error(err); return null; }),
        ]);

        const matches = matchesResult?.success ? matchesResult.data : null;
        const receivedConnections = receivedResult?.success ? receivedResult.data : [];
        const dealRooms = dealRoomsResult?.success ? dealRoomsResult.data : [];

        // "Waiting" = every candidate the matching engine currently returns for this
        // profile (already excludes anyone already connected/requested) — capped at
        // the engine's own MATCHES_LIMIT (10), so this is "up to 10", not a true total.
        const introductionsWaitingCount = (matches?.matches || []).length;
        const topIntroductions = (matches?.matches || []).slice(0, TOP_INTRODUCTIONS_LIMIT);
        const requestsForYou = (receivedConnections || [])
            .filter((connection) => connection.status === CONNECTION_STATUS.PENDING)
            .slice(0, REQUESTS_FOR_YOU_LIMIT);

        // `null` here means "unknown" (the matching call failed), distinct from a
        // confirmed `false` — a failed lookup must never be reported as "not
        // subscribed", or a paying member would be shown the trial upsell.
        const hasActiveSubscription = matches ? matches.hasActiveSubscription : null;
        const trialDaysRemaining = hasActiveSubscription === false
            ? await getTrialDaysRemaining(userId).catch((err) => { errorLogger.error(err); return null; })
            : null;

        return ServiceResponse.success({
            message: DASHBOARD_MESSAGES.FETCH_SUCCESS,
            data: {
                introductionsWaitingCount,
                topIntroductions,
                requestsForYou,
                dealRooms: (dealRooms || []).slice(0, DEAL_ROOMS_PANEL_LIMIT),
                monthlyRequests: {
                    sent: matches?.requestsSentInWindow ?? 0,
                    limit: matches?.requestLimit ?? 0,
                    remaining: matches?.requestsRemaining ?? 0,
                },
                membership: {
                    hasActiveSubscription,
                    trialDaysRemaining,
                },
                // Dummy data — no Vouch/Referral model exists yet.
                vouch: getDummyVouchData(),
            },
            statusCode: 200,
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DASHBOARD_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

const getAdminDashboard = async ({ adminId }) => {
    try {
        const [adminProfile, userCounts, kycCounts] = await Promise.all([
            dashboardRepository.getAdminProfile(adminId)
                .catch((err) => { errorLogger.error(err); return null; }),
            dashboardRepository.getUserCounts()
                .catch((err) => { errorLogger.error(err); return {}; }),
            dashboardRepository.getKycStatusCounts()
                .catch((err) => { errorLogger.error(err); return {}; }),
        ]);

        return ServiceResponse.success({
            message: DASHBOARD_MESSAGES.FETCH_SUCCESS,
            data: {
                adminProfile: {
                    name: adminProfile?.name || '',
                    role: adminProfile?.role || '',
                },
                stats: {
                    totalUsers:                parseInt(userCounts.total           || 0),
                    suspendedUsers:            parseInt(userCounts.suspended       || 0),
                    newRegistrationsLast7Days: parseInt(userCounts.new_last_7_days || 0),
                    kycPending:                parseInt(kycCounts.pending          || 0),
                    kycApproved:               parseInt(kycCounts.approved         || 0),
                    kycRejected:               parseInt(kycCounts.rejected         || 0),
                },
            },
            statusCode: 200,
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DASHBOARD_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// ─── Super Admin Dashboard ────────────────────────────────────────────────────

const getSuperAdminDashboard = async ({ adminId }) => {
    try {
        const [
            adminProfile,
            userCounts,
            kycCounts,
            totalOrganizations,
            activeToday,
            adminAccountCounts,
        ] = await Promise.all([
            dashboardRepository.getAdminProfile(adminId)
                .catch((err) => { errorLogger.error(err); return null; }),
            dashboardRepository.getUserCounts()
                .catch((err) => { errorLogger.error(err); return {}; }),
            dashboardRepository.getKycStatusCounts()
                .catch((err) => { errorLogger.error(err); return {}; }),
            dashboardRepository.getTotalOrganizationsCount()
                .catch((err) => { errorLogger.error(err); return 0; }),
            // activeToday is derived from user_session.last_activity_at, which is
            // only written when SESSION_LIMIT_ENABLED=true (env default: false).
            // Silent fallback to 0 is intentional — this is a best-effort KPI,
            // not a hard dependency. Ensure SESSION_LIMIT_ENABLED=true in every
            // environment where this stat is expected to be non-zero.
            dashboardRepository.getActiveTodayCount()
                .catch(() => 0),
            dashboardRepository.getAdminAccountCounts()
                .catch((err) => { errorLogger.error(err); return {}; }),
        ]);

        return ServiceResponse.success({
            message: DASHBOARD_MESSAGES.FETCH_SUCCESS,
            data: {
                adminProfile: {
                    name: adminProfile?.name || '',
                    role: adminProfile?.role || '',
                },
                stats: {
                    totalUsers:                parseInt(userCounts.total              || 0),
                    totalOrganizations:        totalOrganizations,
                    kycPending:                parseInt(kycCounts.pending             || 0),
                    activeToday:               activeToday,
                    kycApproved:               parseInt(kycCounts.approved            || 0),
                    kycRejected:               parseInt(kycCounts.rejected            || 0),
                    suspendedUsers:            parseInt(userCounts.suspended          || 0),
                    newRegistrationsLast7Days: parseInt(userCounts.new_last_7_days    || 0),
                    totalAdmins:               parseInt(adminAccountCounts.total      || 0),
                    activeAdmins:              parseInt(adminAccountCounts.active     || 0),
                    suspendedAdmins:           parseInt(adminAccountCounts.suspended  || 0),
                },
            },
            statusCode: 200,
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DASHBOARD_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

module.exports = { getUserDashboard, getUserDashboardHome, getAdminDashboard, getSuperAdminDashboard };