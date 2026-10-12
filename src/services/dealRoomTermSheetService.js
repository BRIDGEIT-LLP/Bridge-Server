'use strict';

/**
 * B2B collaborative Term Sheet — no accept/reject state machine. Either B2B party can
 * save an edit at any time; every save is a new versioned row (never an update of the
 * old one), so the full edit history is transparent to both sides. All reads AND
 * writes are socket-only (see termSheetSocketHandler.js) — this feature has no REST
 * surface at all.
 */

const { errorLogger } = require('../configs/logger');
const dealRoomTermSheetRepository = require('../repositories/dealRoomTermSheetRepository');
const dealRoomRepository = require('../repositories/dealRoomRepository');
const dealRoomService = require('./dealRoomService');
const ServiceResponse = require('../utils/ServiceResponse');
const { DEAL_ROOM_STATUS, DEAL_ROOM_STAGES, DEAL_ROOM_TERM_SHEET_MESSAGES, USER_ROLES_CODE } = require('../utils/constant');
const { validateTermSheetPayload } = require('../validations/dealRoomTermSheetValidation');

// Both sides of the room must be B2B enterprises — mirrors getOfferParticipants in
// dealRoomOfferService.js, which does the same for the Investor/Startup pair.
const getB2BParticipants = (dealRoom) => {
    if (!dealRoom.requesterRole || !dealRoom.recipientRole) {
        return null;
    }

    if (dealRoom.requesterRole.role_code !== USER_ROLES_CODE.B2B || dealRoom.recipientRole.role_code !== USER_ROLES_CODE.B2B) {
        return null;
    }

    return {
        a: { userId: dealRoom.requester_user_id, roleId: dealRoom.requester_role_id, companyId: dealRoom.requester_company_id },
        b: { userId: dealRoom.recipient_user_id, roleId: dealRoom.recipient_role_id, companyId: dealRoom.recipient_company_id }
    };
};

// Shared guard chain: deal room must exist, caller must be a participant, the room
// must be Active, and both sides must be B2B.
const loadEligibleDealRoom = async (dealRoomId, userId) => {
    const dealRoom = await dealRoomRepository.findByIdWithRoles(dealRoomId);
    if (!dealRoom) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 }) };
    }
    if (!dealRoomService.isParticipant(dealRoom, userId)) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.FORBIDDEN, statusCode: 403 }) };
    }
    if (dealRoom.status !== DEAL_ROOM_STATUS.ACTIVE) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.DEAL_ROOM_CLOSED, statusCode: 400 }) };
    }
    const participants = getB2BParticipants(dealRoom);
    if (!participants) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.INVALID_ROLE_PAIR, statusCode: 400 }) };
    }
    return { dealRoom, participants };
};

const updateTermSheet = async ({ dealRoomId, userId, ...formFields }) => {
    try {
        const { error: validationError } = validateTermSheetPayload({ dealRoomId, ...formFields });
        if (validationError) {
            return ServiceResponse.error({ message: validationError.details.map((d) => d.message), statusCode: 400 });
        }

        const { error, dealRoom } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            return error;
        }

        // Term sheet edits are only allowed while the deal is actively being
        // negotiated — once it advances to Due Diligence (or beyond), the sheet
        // becomes read-only for both parties.
        if (dealRoom.stage !== DEAL_ROOM_STAGES.NEGOTIATION) {
            return ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.NOT_NEGOTIATION_STAGE, statusCode: 400 });
        }

        const latest = await dealRoomTermSheetRepository.findLatestByDealRoomId(dealRoomId);
        const sheet = await dealRoomTermSheetRepository.create({
            deal_room_id: dealRoomId,
            version: latest ? latest.version + 1 : 1,
            moq_quantity: formFields.moqQuantity,
            moq_unit: formFields.moqUnit,
            unit_price: formFields.unitPrice,
            currency: formFields.currency,
            payment_terms: formFields.paymentTerms,
            supply_logistics_terms: formFields.supplyLogisticsTerms,
            updated_by_user_id: userId,
            created_by: userId
        });

        return ServiceResponse.success({ data: sheet, message: DEAL_ROOM_TERM_SHEET_MESSAGES.SAVE_SUCCESS, statusCode: 201 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.SAVE_FAILED, statusCode: 500 });
    }
};

const getCurrentTermSheet = async (dealRoomId, userId) => {
    try {
        const { error } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            return error;
        }

        const sheet = await dealRoomTermSheetRepository.findLatestByDealRoomId(dealRoomId);
        return ServiceResponse.success({ data: sheet, message: DEAL_ROOM_TERM_SHEET_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

const getTermSheetHistory = async (dealRoomId, userId) => {
    try {
        const { error } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            return error;
        }

        const sheets = await dealRoomTermSheetRepository.findAllByDealRoomId(dealRoomId);
        return ServiceResponse.success({ data: sheets, message: DEAL_ROOM_TERM_SHEET_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_TERM_SHEET_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

module.exports = { getB2BParticipants, updateTermSheet, getCurrentTermSheet, getTermSheetHistory };
