'use strict';

const { errorLogger } = require('../configs/logger');
const faqService = require('../services/faqService');
const permissionService = require('../services/permissionService');
const { FAQ_MESSAGES, ADMIN_PERMISSION_KEYS, USER_TYPE_VALUES } = require('../utils/constant');
const HttpResponse = require('../utils/HttpResponse');

const canManageFaq = async (adminId) => {
    const permissions = await permissionService.getAdminPermissions(adminId);
    const faqPermission = permissions.find((p) => p.permission_key === ADMIN_PERMISSION_KEYS.FAQ_MANAGEMENT);

    return Boolean(faqPermission && faqPermission.is_allowed);
};

// ── User-facing ───────────────────────────────────────────────────────────────

const getFaqs = async (req, res, next) => {
    try {
        const faqsResponse = await faqService.getFaqs();
        if (!faqsResponse.success) {
            return HttpResponse.error(res, {
                message: faqsResponse.message,
                data: faqsResponse.data,
                statusCode: faqsResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: faqsResponse.message,
            data: faqsResponse.data,
            statusCode: faqsResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: FAQ_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

// ── Admin-facing ──────────────────────────────────────────────────────────────

const getAllFaqsForAdmin = async (req, res, next) => {
    try {
        const faqsResponse = await faqService.getAllFaqsForAdmin();
        if (!faqsResponse.success) {
            return HttpResponse.error(res, {
                message: faqsResponse.message,
                data: faqsResponse.data,
                statusCode: faqsResponse.statusCode
            });
        }

        const adminId = req.adminId;
        const isAllowdToUpsert = await canManageFaq(adminId);

        return HttpResponse.success(res, {
            message: faqsResponse.message,
            data: {isAllowdToUpsert, faqs: faqsResponse.data},
            statusCode: faqsResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: FAQ_MESSAGES.FETCH_FAILED,
            statusCode: 500
        });
    }
};

const createFaq = async (req, res, next) => {
    try {
        const { question, answer, is_active } = req.body;
        const adminId = req.adminId;

        if (!(await canManageFaq(adminId))) {
            return HttpResponse.error(res, {
                message: FAQ_MESSAGES.PERMISSION_DENIED,
                statusCode: 403
            });
        }

        if (!question || typeof question !== 'string' || !question.trim()) {
            return HttpResponse.error(res, {
                message: 'question is required and must be a non-empty string',
                statusCode: 400
            });
        }

        if (!answer || typeof answer !== 'string' || !answer.trim()) {
            return HttpResponse.error(res, {
                message: 'answer is required and must be a non-empty string',
                statusCode: 400
            });
        }

        const faqData = {
            question: question.trim(),
            answer: answer.trim(),
            is_active: typeof is_active === 'boolean' ? is_active : true
        };

        const createResponse = await faqService.createFaq(faqData, adminId);
        if (!createResponse.success) {
            return HttpResponse.error(res, {
                message: createResponse.message,
                statusCode: createResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: createResponse.message,
            data: createResponse.data,
            statusCode: createResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: FAQ_MESSAGES.CREATE_FAILED,
            statusCode: 500
        });
    }
};

const updateFaq = async (req, res, next) => {
    try {
        const faqId = parseInt(req.params.id, 10);
        const adminId = req.adminId;

        if (!(await canManageFaq(adminId))) {
            return HttpResponse.error(res, {
                message: FAQ_MESSAGES.PERMISSION_DENIED,
                statusCode: 403
            });
        }

        if (!req.params.id || isNaN(faqId) || faqId <= 0) {
            return HttpResponse.error(res, {
                message: 'FAQ id must be a positive integer',
                statusCode: 400
            });
        }

        const { question, answer, is_active } = req.body;
        const payload = {};

        if (question !== undefined) {
            if (typeof question !== 'string' || !question.trim()) {
                return HttpResponse.error(res, {
                    message: 'question must be a non-empty string',
                    statusCode: 400
                });
            }
            payload.question = question.trim();
        }

        if (answer !== undefined) {
            if (typeof answer !== 'string' || !answer.trim()) {
                return HttpResponse.error(res, {
                    message: 'answer must be a non-empty string',
                    statusCode: 400
                });
            }
            payload.answer = answer.trim();
        }

        if (is_active !== undefined) {
            payload.is_active = Boolean(is_active);
        }

        if (Object.keys(payload).length === 0) {
            return HttpResponse.error(res, {
                message: 'At least one field (question, answer, is_active) must be provided',
                statusCode: 400
            });
        }

        const updateResponse = await faqService.updateFaq(payload, faqId, adminId);
        if (!updateResponse.success) {
            return HttpResponse.error(res, {
                message: updateResponse.message,
                statusCode: updateResponse.statusCode
            });
        }

        return HttpResponse.success(res, {
            message: updateResponse.message,
            data: updateResponse.data,
            statusCode: updateResponse.statusCode
        });
    } catch (error) {
        console.error(error);
        errorLogger.error(error);
        return HttpResponse.error(res, {
            message: FAQ_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getFaqs, getAllFaqsForAdmin, createFaq, updateFaq };