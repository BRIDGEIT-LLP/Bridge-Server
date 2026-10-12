'use strict';

const { QueryTypes } = require('sequelize');
const { DealRoom, CompanyRoleMaster, sequelize } = require('../models');
const { DEAL_ROOM_STATUS } = require('../utils/constant');

const create = async (data, { transaction } = {}) => {
    return await DealRoom.create(data, { transaction });
};

const findById = async (dealRoomId) => {
    return await DealRoom.findOne({
        where: { id: dealRoomId, is_deleted: false }
    });
};

// Deal room with both participants' role rows eager-loaded — used by the offer and
// term-sheet services to validate the Investor/Startup or B2B/B2B role pair.
const findByIdWithRoles = async (dealRoomId) => {
    return await DealRoom.findOne({
        where: { id: dealRoomId, is_deleted: false },
        include: [
            { model: CompanyRoleMaster, as: 'requesterRole' },
            { model: CompanyRoleMaster, as: 'recipientRole' }
        ]
    });
};

const closeById = async (dealRoomId, { closedReason, closedBy }, { transaction } = {}) => {
    const [, [updated]] = await DealRoom.update(
        {
            status: DEAL_ROOM_STATUS.CLOSED,
            closed_at: new Date(),
            closed_reason: closedReason,
            closed_by: closedBy,
            updated_at: new Date(),
            updated_by: closedBy
        },
        { where: { id: dealRoomId }, returning: true, transaction }
    );
    return updated;
};

const updateStage = async (dealRoomId, stage, { updatedBy, transaction } = {}) => {
    const [, [updated]] = await DealRoom.update(
        {
            stage,
            updated_at: new Date(),
            updated_by: updatedBy
        },
        { where: { id: dealRoomId }, returning: true, transaction }
    );
    return updated;
};

const findAllByUserId = async (userId, roleId, { archived = false } = {}) => {
    return await sequelize.query(
        `SELECT
            dr.id AS deal_room_id,
            dr.connection_id,
            dr.title,
            dr.status AS deal_room_status,
            dr.stage AS deal_room_stage,
            dr.closed_at,
            dr.closed_reason,
            dr.created_at AS deal_room_created_at,

            dra.archived_at,

            uc.status AS connection_status,
            uc.message AS connection_message,
            uc.created_at AS connection_requested_at,
            uc.updated_at AS connection_accepted_at,

            ru.id AS requester_user_id,
            ru.first_name AS requester_first_name,
            ru.last_name AS requester_last_name,
            ru.country AS requester_country,
            ru.profile_photo AS requester_profile_photo,
            dr.requester_role_id AS requester_role_id,
            r_crm.role_code AS requester_role_code,
            r_crm.role_name AS requester_role_name,
            r_c.id AS requester_company_id,
            r_c.company_name AS requester_company_name,

            rec_u.id AS recipient_user_id,
            rec_u.first_name AS recipient_first_name,
            rec_u.last_name AS recipient_last_name,
            rec_u.country AS recipient_country,
            rec_u.profile_photo AS recipient_profile_photo,
            dr.recipient_role_id AS recipient_role_id,
            rec_crm.role_code AS recipient_role_code,
            rec_crm.role_name AS recipient_role_name,
            rec_c.id AS recipient_company_id,
            rec_c.company_name AS recipient_company_name

        FROM deal_room dr
        LEFT JOIN deal_room_archive dra
            ON dra.deal_room_id = dr.id AND dra.user_id = :userId AND dra.is_deleted = false
        JOIN user_connection     uc      ON uc.id      = dr.connection_id
        JOIN "user"              ru      ON ru.id      = dr.requester_user_id
        JOIN company_role_master r_crm  ON r_crm.id   = dr.requester_role_id
        JOIN company             r_c    ON r_c.id      = dr.requester_company_id
        JOIN "user"              rec_u   ON rec_u.id   = dr.recipient_user_id
        JOIN company_role_master rec_crm ON rec_crm.id = dr.recipient_role_id
        JOIN company             rec_c   ON rec_c.id   = dr.recipient_company_id
        WHERE dr.is_deleted IS NOT TRUE
          AND (
              (dr.requester_user_id = :userId AND dr.requester_role_id = :roleId)
              OR (dr.recipient_user_id = :userId AND dr.recipient_role_id = :roleId)
          )
          AND dra.archived_at IS ${archived ? 'NOT NULL' : 'NULL'}
        ORDER BY dr.created_at DESC`,
        {
            replacements: { userId, roleId },
            type: QueryTypes.SELECT
        }
    );
};

module.exports = { create, findById, findByIdWithRoles, closeById, updateStage, findAllByUserId };
