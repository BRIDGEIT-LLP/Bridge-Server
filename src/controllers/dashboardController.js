'use strict';
const { errorLogger } = require('../configs/logger');
const dashboardService = require('../services/dashboardService');
const { DASHBOARD_MESSAGES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

/**
 * GET /api/v1/users/dashboard
 *
 * Guarded by authMiddleware → authorize(PERMISSIONS.USER.VIEW_DASHBOARD).
 * req.userId is extracted from the JWT payload by authMiddleware.
 *
 * Returns: profile summary + role-specific stat counters.
 * The frontend maps the flat stats object to whichever labels each role view
 * shows (StartupView, InvestorView, B2BView).
 */
const getUserDashboard = async (req, res) => {
    try {
        const { userId } = req;

        const result = await dashboardService.getUserDashboard({ userId });
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode,
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode,
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: DASHBOARD_MESSAGES.FETCH_FAILED,
            statusCode: 500,
        });
    }
};

/**
 * GET /api/v1/admin/dashboard
 *
 * Guarded by adminMiddleware → authorize(PERMISSIONS.ADMIN_DASHBOARD.VIEW).
 * req.adminId is extracted from the JWT payload by adminMiddleware.
 *
 * Returns: acting admin's profile + user / KYC aggregate KPIs.
 */
const getAdminDashboard = async (req, res) => {
    try {
        const { adminId } = req;

        const result = await dashboardService.getAdminDashboard({ adminId });
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode,
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode,
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: DASHBOARD_MESSAGES.FETCH_FAILED,
            statusCode: 500,
        });
    }
};

/**
 * GET /api/v1/super-admin/dashboard
 *
 * Guarded by adminMiddleware → authorize(PERMISSIONS.SUPER_ADMIN_DASHBOARD.VIEW).
 * req.adminId is extracted from the JWT payload by adminMiddleware.
 *
 * Returns: acting admin's profile + full platform-wide KPIs (user counts,
 * organisations, KYC pipeline, active-today, admin account health).
 */
const getSuperAdminDashboard = async (req, res) => {
    try {
        const { adminId } = req;

        const result = await dashboardService.getSuperAdminDashboard({ adminId });
        if (!result.success) {
            return HttpResponse.error(res, {
                message: result.message,
                statusCode: result.statusCode,
            });
        }

        return HttpResponse.success(res, {
            message: result.message,
            data: result.data,
            statusCode: result.statusCode,
        });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: DASHBOARD_MESSAGES.FETCH_FAILED,
            statusCode: 500,
        });
    }
};

module.exports = { getUserDashboard, getAdminDashboard, getSuperAdminDashboard };
