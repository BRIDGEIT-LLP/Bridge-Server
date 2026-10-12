'use strict';

const { sequelize } = require('../models');
const faqRepository = require('../repositories/faqRepository');
const { errorLogger } = require('../configs/logger');
const ServiceResponse = require('../utils/ServiceResponse');
const { FAQ_MESSAGES } = require('../utils/constant');

// ── User-facing ───────────────────────────────────────────────────────────────

const getFaqs = async () => {
    try {
        const faqs = await faqRepository.getActiveFaqs();
        return ServiceResponse.success({
            message: FAQ_MESSAGES.FETCH_SUCCESS,
            data: faqs,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: FAQ_MESSAGES.FETCH_FAILED,
            data: [],
            statusCode: 500
        });
    }
};

// ── Admin-facing ──────────────────────────────────────────────────────────────

const getAllFaqsForAdmin = async () => {
    try {
        const faqs = await faqRepository.getAllFaqs();
        return ServiceResponse.success({
            message: FAQ_MESSAGES.FETCH_SUCCESS,
            data: faqs,
            statusCode: 200
        });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({
            message: FAQ_MESSAGES.FETCH_FAILED,
            data: [],
            statusCode: 500
        });
    }
};

const createFaq = async (faqData, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        const faq = await faqRepository.createFaq(
            { ...faqData, created_by: adminId },
            transaction
        );
        await transaction.commit();
        return ServiceResponse.success({
            message: FAQ_MESSAGES.CREATE_SUCCESS,
            data: { id: faq.id },
            statusCode: 201
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: FAQ_MESSAGES.CREATE_FAILED,
            statusCode: 500
        });
    }
};

const updateFaq = async (faqData, faqId, adminId) => {
    const transaction = await sequelize.transaction();
    try {
        const existing = await faqRepository.getFaqById(faqId);
        if (!existing) {
            await transaction.rollback();
            return ServiceResponse.error({
                message: FAQ_MESSAGES.NOT_FOUND,
                statusCode: 404
            });
        }

        const updated = await faqRepository.updateFaq(
            { ...faqData, updated_by: adminId },
            faqId,
            { transaction }
        );
        await transaction.commit();
        return ServiceResponse.success({
            message: FAQ_MESSAGES.UPDATE_SUCCESS,
            data: { id: updated.id },
            statusCode: 200
        });
    } catch (error) {
        await transaction.rollback();
        errorLogger.error(error);
        return ServiceResponse.error({
            message: FAQ_MESSAGES.UPDATE_FAILED,
            statusCode: 500
        });
    }
};

module.exports = { getFaqs, getAllFaqsForAdmin, createFaq, updateFaq };