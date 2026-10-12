'use strict';

const { Op, QueryTypes } = require('sequelize');
const { UserConnection, CompanyUserRole, CompanyRoleMaster, sequelize } = require('../models');
const { CONNECTION_STATUS, CONNECTION_BLOCKING_STATUSES, CONNECTION_REOPENABLE_STATUSES } = require('../utils/constant');

const pairWhere = (requesterUserId, requesterRoleId, recipientUserId, recipientRoleId) => ({
    requester_user_id: requesterUserId,
    requester_role_id: requesterRoleId,
    recipient_user_id: recipientUserId,
    recipient_role_id: recipientRoleId
});

const findExistingConnection = async (requesterUserId, requesterRoleId, recipientUserId, recipientRoleId) => {
    return await UserConnection.findOne({
        where: {
            is_deleted: false,
            status: { [Op.in]: CONNECTION_BLOCKING_STATUSES },
            [Op.or]: [
                pairWhere(requesterUserId, requesterRoleId, recipientUserId, recipientRoleId),
                pairWhere(recipientUserId, recipientRoleId, requesterUserId, requesterRoleId)
            ]
        }
    });
};

const softDeleteReopenableConnections = async (requesterUserId, requesterRoleId, recipientUserId, recipientRoleId, deletedBy, { transaction } = {}) => {
    return await UserConnection.update(
        {
            is_deleted: true,
            deleted_at: new Date(),
            deleted_by: deletedBy,
            updated_at: new Date()
        },
        {
            where: {
                is_deleted: false,
                status: { [Op.in]: CONNECTION_REOPENABLE_STATUSES },
                ...pairWhere(requesterUserId, requesterRoleId, recipientUserId, recipientRoleId)
            },
            transaction
        }
    );
};

const findRecipientCompanyUserRole = async (userId, roleId) => {
    return await CompanyUserRole.findOne({
        where: { user_id: userId, role_id: roleId, is_deleted: false },
        include: [{ model: CompanyRoleMaster, as: 'role' }]
    });
};

const create = async (data, { transaction } = {}) => {
    return await UserConnection.create(data, { transaction });
};

const findById = async (connectionId) => {
    return await UserConnection.findOne({
        where: { id: connectionId, is_deleted: false }
    });
};

const updateStatus = async (connectionId, status, reason, { transaction } = {}) => {
    const [, [updated]] = await UserConnection.update(
        { status, updated_at: new Date() },
        { where: { id: connectionId }, returning: true, transaction }
    );
    return updated;
};

const countRequestsInWindow = async (userId, windowStart, windowEnd) => {
    return await UserConnection.count({
        where: {
            requester_user_id: userId,
            is_deleted: false,
            created_at: {
                [Op.gte]: windowStart,
                [Op.lt]: windowEnd
            }
        }
    });
};

const findSentByUser = async (userId, roleId) => {
    return await sequelize.query(
        `SELECT
            uc.id AS connection_id,
            uc.status AS connection_status,
            uc.product_service_details,
            uc.expected_deal_size,
            uc.bussiness_intent,
            uc.message AS connection_message,
            uc.created_at AS connection_requested_at,
            uc.updated_at AS connection_updated_at,

            uc.requester_user_id,
            uc.requester_role_id,
            uc.requester_company_id,

            rec_u.id AS recipient_user_id,
            rec_u.first_name AS recipient_first_name,
            rec_u.last_name AS recipient_last_name,
            rec_u.profile_photo AS recipient_profile_photo,
            uc.recipient_role_id,
            rec_crm.role_code AS recipient_role_code,
            rec_crm.role_name AS recipient_role_name,
            rec_c.id AS recipient_company_id,
            rec_c.company_name AS recipient_company_name

        FROM user_connection uc

        JOIN "user" rec_u   ON rec_u.id   = uc.recipient_user_id
        JOIN company_role_master rec_crm ON rec_crm.id = uc.recipient_role_id
        JOIN company rec_c   ON rec_c.id   = uc.recipient_company_id

        WHERE uc.is_deleted IS NOT TRUE
        AND uc.requester_user_id = :userId
        AND uc.requester_role_id = :roleId
        AND uc.status in ('${CONNECTION_STATUS.PENDING}', '${CONNECTION_STATUS.VIEWED}', '${CONNECTION_STATUS.DEFERRED}', '${CONNECTION_STATUS.WITHDRAWN}')

        ORDER BY uc.created_at desc`,
        {
            replacements: { userId, roleId },
            type: QueryTypes.SELECT
        }
    );
};

const findReceivedByUser = async (userId, roleId) => {
    return await sequelize.query(
        `SELECT
            uc.id AS connection_id,
            uc.status AS connection_status,
            uc.product_service_details,
            uc.expected_deal_size,
            uc.bussiness_intent,
            uc.message AS connection_message,
            uc.created_at AS connection_requested_at,
            uc.updated_at AS connection_updated_at,

            req_u.id AS requester_user_id,
            req_u.first_name AS requester_first_name,
            req_u.last_name AS requester_last_name,
            req_u.profile_photo AS requester_profile_photo,
            uc.requester_role_id,
            req_crm.role_code AS requester_role_code,
            req_crm.role_name AS requester_role_name,
            req_c.id AS requester_company_id,
            req_c.company_name AS requester_company_name,

            uc.recipient_user_id,
            uc.recipient_role_id,
            uc.recipient_company_id

        FROM user_connection uc

        JOIN "user" req_u   ON req_u.id   = uc.requester_user_id
        JOIN company_role_master req_crm ON req_crm.id = uc.requester_role_id
        JOIN company req_c   ON req_c.id   = uc.requester_company_id

        WHERE uc.is_deleted IS NOT TRUE
          AND uc.recipient_user_id = :userId
          AND uc.recipient_role_id = :roleId
          AND uc.status in ('${CONNECTION_STATUS.PENDING}', '${CONNECTION_STATUS.VIEWED}', '${CONNECTION_STATUS.DEFERRED}', '${CONNECTION_STATUS.DECLINED}')

        ORDER BY uc.created_at DESC`,
        {
            replacements: { userId, roleId },
            type: QueryTypes.SELECT
        }
    );
};

module.exports = {
    findExistingConnection,
    softDeleteReopenableConnections,
    findRecipientCompanyUserRole,
    create,
    findById,
    updateStatus,
    countRequestsInWindow,
    findSentByUser,
    findReceivedByUser
};
