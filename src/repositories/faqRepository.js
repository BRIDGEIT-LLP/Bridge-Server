'use strict';

const { Faq } = require('../models');

// ── User-facing ───────────────────────────────────────────────────────────────

const getActiveFaqs = async () => {
    return await Faq.findAll({
        where: { is_active: true },
        attributes: ['id', 'question', 'answer'],
        order: [['id', 'ASC']]
    });
};

// ── Admin-facing ──────────────────────────────────────────────────────────────

const getAllFaqs = async () => {
    return await Faq.findAll({
        attributes: ['id', 'question', 'answer', 'is_active', 'created_at', 'updated_at'],
        order: [['id', 'ASC']]
    });
};

const getFaqById = async (faqId) => {
    return await Faq.findOne({
        where: { id: faqId }
    });
};

const createFaq = async (faqData, transaction) => {
    return await Faq.create(faqData, { transaction });
};

const updateFaq = async (faqData, faqId, { transaction } = {}) => {
    const [updatedCount, updatedRows] = await Faq.update(
        {
            ...faqData,
            updated_at: new Date()
        },
        {
            where: { id: faqId },
            returning: true,
            transaction
        }
    );

    if (updatedCount === 0) {
        throw new Error(`FAQ not found with id ${faqId}`);
    }

    return updatedRows[0];
};

module.exports = {
    getActiveFaqs,
    getAllFaqs,
    getFaqById,
    createFaq,
    updateFaq
};