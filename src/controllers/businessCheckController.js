'use strict';
const businessCheckService = require('../services/businessCheckService');
const HttpResponse = require('../utils/HttpResponse');
const { errorLogger } = require('../configs/logger');
const { BUSINESS_CHECK_MESSAGES, DRAFT_STEPS, DRAFT_MESSAGES } = require('../utils/constant');

// PUT /api/v1/users/business-check
const saveBusinessCheck = async (req, res) => {
    try {
        // ?draft=true&step=business keeps whatever is filled in without requiring the rest.
        const draft = req.query.draft === 'true';
        const step = req.query.step || 'business';
        if (draft && !DRAFT_STEPS.includes(step)) {
            return HttpResponse.error(res, { message: DRAFT_MESSAGES.INVALID_STEP, statusCode: 400 });
        }
        const result = await businessCheckService.saveBusinessCheck({
            userId: req.userId,
            companyId: req.companyId,
            roleId: req.roleId,
            role: req.role,
            body: req.body,
            draft,
            step
        });
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, data: result.data, statusCode: result.statusCode });
        }
        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: BUSINESS_CHECK_MESSAGES.SAVE_FAILED, statusCode: 500 });
    }
};

// GET /api/v1/users/business-check
const getBusinessCheck = async (req, res) => {
    try {
        const result = await businessCheckService.getBusinessCheck({
            userId: req.userId,
            companyId: req.companyId,
            roleId: req.roleId,
            role: req.role
        });
        if (!result.success) {
            return HttpResponse.error(res, { message: result.message, data: result.data, statusCode: result.statusCode });
        }
        return HttpResponse.success(res, { message: result.message, data: result.data, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return HttpResponse.error(res, { message: BUSINESS_CHECK_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

module.exports = { saveBusinessCheck, getBusinessCheck };
