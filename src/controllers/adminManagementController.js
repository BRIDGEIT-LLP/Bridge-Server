'use strict';
const { ADMIN_MANAGEMENT_MESSAGES, ADMIN_STATUS } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');
const { errorLogger } = require('../configs/logger');
const adminManagementService = require('../services/adminManagementService');

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VALID_STATUSES = [ADMIN_STATUS.ACTIVE, ADMIN_STATUS.SUSPENDED];

const getAdminList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const { search } = req.query;
        const status = req.query.status ? req.query.status.toUpperCase() : undefined;

        if (page < 1 || limit < 1 || limit > 100) {
            return HttpResponse.error(res, {
                message: 'page must be >= 1 and limit must be between 1 and 100',
                statusCode: 400
            });
        }

        if (status && !VALID_STATUSES.includes(status)) {
            return HttpResponse.error(res, {
                message: `status must be one of: ${VALID_STATUSES.join(', ')}`,
                statusCode: 400
            });
        }

        const result = await adminManagementService.getAdminList({ page, limit, status, search });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.LIST_FAILED, statusCode: 500 });
    }
};

const getAdminDetail = async (req, res, next) => {
    try {
        const { adminId } = req.params;

        if (!adminId || !UUID_REGEX.test(adminId)) {
            return HttpResponse.error(res, { message: 'Invalid adminId', statusCode: 400 });
        }

        const result = await adminManagementService.getAdminDetail(adminId);

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.DETAIL_FAILED, statusCode: 500 });
    }
};

const createAdmin = async (req, res, next) => {
    try {
        const performedBy = req.adminId;
        const { name, email, password, country_code, mobile_number, role, permissions } = req.body;

        const result = await adminManagementService.createAdmin({
            name,
            email,
            password,
            country_code,
            mobile_number,
            role,
            permissions: permissions || [],
            performedBy
        });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 201 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.CREATE_FAILED, statusCode: 500 });
    }
};

const updateAdmin = async (req, res, next) => {
    try {
        const performedBy = req.adminId;
        const { adminId } = req.params;

        if (!adminId || !UUID_REGEX.test(adminId)) {
            return HttpResponse.error(res, { message: 'Invalid adminId', statusCode: 400 });
        }

        const result = await adminManagementService.updateAdmin({
            adminId,
            payload: req.body,
            performedBy
        });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.UPDATE_FAILED, statusCode: 500 });
    }
};

const deleteAdmin = async (req, res, next) => {
    try {
        const performedBy = req.adminId;
        const { adminId } = req.params;

        if (!adminId || !UUID_REGEX.test(adminId)) {
            return HttpResponse.error(res, { message: 'Invalid adminId', statusCode: 400 });
        }

        const { reason } = req.body;

        const result = await adminManagementService.deleteAdmin({ adminId, reason, performedBy });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.DELETE_FAILED, statusCode: 500 });
    }
};

const suspendAdmin = async (req, res, next) => {
    try {
        const performedBy = req.adminId;
        const { adminId } = req.params;

        if (!adminId || !UUID_REGEX.test(adminId)) {
            return HttpResponse.error(res, { message: 'Invalid adminId', statusCode: 400 });
        }

        const { reason } = req.body;

        const result = await adminManagementService.suspendAdmin({ adminId, reason, performedBy });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.SUSPEND_FAILED, statusCode: 500 });
    }
};

const activateAdmin = async (req, res, next) => {
    try {
        const performedBy = req.adminId;
        const { adminId } = req.params;

        if (!adminId || !UUID_REGEX.test(adminId)) {
            return HttpResponse.error(res, { message: 'Invalid adminId', statusCode: 400 });
        }

        const { reason } = req.body;

        const result = await adminManagementService.activateAdmin({ adminId, reason, performedBy });

        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, statusCode: result.statusCode });
        }

        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: ADMIN_MANAGEMENT_MESSAGES.ACTIVATE_FAILED, statusCode: 500 });
    }
};

module.exports = {
    getAdminList,
    getAdminDetail,
    createAdmin,
    updateAdmin,
    deleteAdmin,
    suspendAdmin,
    activateAdmin
};