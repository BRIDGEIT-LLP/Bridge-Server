'use strict';
const { KycInfo, sequelize } = require('../models');
const { QueryTypes } = require('sequelize');
const { KYC_DOC_TYPES } = require('../utils/constant');

// `options` carries the caller's { transaction } — the insert-vs-update decision in
// kycService.createKycInfo must read inside the same transaction it writes in, or it
// reads a stale snapshot on a separate connection.
const findKycRecord = async ({ userId, companyId, roleId, documentType }, options = {}) => {
    return await KycInfo.findOne({
        where: {
            user_id: userId ?? null,
            company_id: companyId ?? null,
            role_id: roleId ?? null,
            document_type: documentType,
            is_deleted: false
        },
        ...options
    });
};

const createKycRecord = async (data, options = {}) => {
    return await KycInfo.create(data, options);
};

const updateKycRecord = async (id, data, options = {}) => {
    const [updatedCount, updatedRows] = await KycInfo.update(
        { ...data, updated_at: new Date() },
        {
            where: { id, is_deleted: false },
            returning: true,
            ...options
        }
    );

    if (updatedCount === 0) {
        throw new Error(`KycInfo record not found with id ${id}`);
    }

    return updatedRows[0];
};

const bulkCreateKycRecords = async (records, options = {}) => {
    return await KycInfo.bulkCreate(records, { returning: true, ...options });
};


const findAllKycRecords = async ({ userId, companyId, roleId }, options = {}) => {
    return await KycInfo.findAll({
        where: {
            user_id: userId,
            company_id: companyId,
            role_id: roleId,
            is_deleted: false
        },
        ...options
    });
};

const findAllKycRecordsRaw = async ({ userId, companyId, roleId }) => {
    return await sequelize.query(
        `SELECT DISTINCT ON (document_type)
            id,
            document_type,
            document_number,
            document_number_iv,
            document_number_auth_tag,
            front_s3_key,
            back_s3_key,
            status,
            rejection_reason,
            verified_at,
            verified_by,
            created_at,
            back_mime_type,
            back_file_name,
            front_mime_type,
            front_file_name    
        FROM kyc_info
        WHERE user_id    = :userId
        AND company_id = :companyId
        AND role_id    = :roleId
        AND is_deleted = false
        AND document_type IN (:kycDocTypes)
        ORDER BY document_type, created_at DESC, id DESC`,
        {
            replacements: { userId, companyId, roleId, kycDocTypes: KYC_DOC_TYPES },
            type: QueryTypes.SELECT
        }
    );
};

module.exports = { findKycRecord, createKycRecord, updateKycRecord, bulkCreateKycRecords, findAllKycRecords, findAllKycRecordsRaw };
