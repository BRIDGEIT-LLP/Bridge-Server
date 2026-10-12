'use strict';

/**
 * Structured Funding Offer — negotiation flow
 *
 * 1. Investor fills the offer form and either saves it as a Draft (saveDraft) or
 *    sends it directly (sendOffer). Sending sets status = Pending and the Founder
 *    is alerted live over the deal room socket channel.
 * 2. The Founder (the row's recipient) can then:
 *       - Accept  → respondOffer(decision: 'Accepted')  — terminal
 *       - Reject  → respondOffer(decision: 'Rejected')  — terminal
 *       - Counter → counterOffer(...) — marks this offer 'Countered' and creates a
 *         NEW Pending row pointed back at the Investor (direction flips).
 * 3. Because each counter swaps the offered_by_* and recipient_* columns, the same
 *    respond/counter functions work for both sides — the negotiation loops until
 *    someone accepts or rejects the current Pending offer.
 *
 * Thread bookkeeping: every row carries root_offer_id (first offer of the thread,
 * equals its own id on the root) so the full history is one flat WHERE query,
 * parent_offer_id (the offer this one countered), version (1, 2, 3, ...) and
 * is_counter_offer. Only ONE Pending offer may exist per deal room at a time,
 * so a thread is always a linear chain, never a tree.
 */

const { sequelize } = require('../models');
const { errorLogger } = require('../configs/logger');
const dealRoomOfferRepository = require('../repositories/dealRoomOfferRepository');
const dealRoomRepository = require('../repositories/dealRoomRepository');
const dealRoomService = require('./dealRoomService');
const ServiceResponse = require('../utils/ServiceResponse');
const {
    DEAL_ROOM_STATUS,
    DEAL_ROOM_STAGES,
    DEAL_ROOM_OFFER_STATUS,
    DEAL_ROOM_OFFER_MESSAGES,
    USER_ROLES_CODE
} = require('../utils/constant');
const { validateOfferPayload } = require('../validations/dealRoomOfferValidation');

// Works out which side of the deal room is the INVESTOR and which is the STARTUP
// (founder) by role_code. Funding offers are only valid for this one role pair —
// any other combination (e.g. B2B<->STARTUP) returns null and the caller rejects
// with INVALID_ROLE_PAIR.
const getOfferParticipants = (dealRoom) => {
    if (!dealRoom.requesterRole || !dealRoom.recipientRole) {
        return null;
    }

    const requester = {
        userId: dealRoom.requester_user_id,
        roleId: dealRoom.requester_role_id,
        companyId: dealRoom.requester_company_id,
        roleCode: dealRoom.requesterRole.role_code
    };
    const recipient = {
        userId: dealRoom.recipient_user_id,
        roleId: dealRoom.recipient_role_id,
        companyId: dealRoom.recipient_company_id,
        roleCode: dealRoom.recipientRole.role_code
    };

    if (requester.roleCode === USER_ROLES_CODE.INVESTOR && recipient.roleCode === USER_ROLES_CODE.STARTUP) {
        return { investor: requester, founder: recipient };
    }
    if (recipient.roleCode === USER_ROLES_CODE.INVESTOR && requester.roleCode === USER_ROLES_CODE.STARTUP) {
        return { investor: recipient, founder: requester };
    }

    return null;
};

// Shared guard chain for every offer mutation: deal room must exist, caller must be a
// participant, the room must be Active, and the pair must actually be Investor<->Startup.
const loadEligibleDealRoom = async (dealRoomId, userId) => {
    const dealRoom = await dealRoomRepository.findByIdWithRoles(dealRoomId);
    if (!dealRoom) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 }) };
    }
    if (!dealRoomService.isParticipant(dealRoom, userId)) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 }) };
    }
    if (dealRoom.status !== DEAL_ROOM_STATUS.ACTIVE) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_CLOSED, statusCode: 400 }) };
    }
    const participants = getOfferParticipants(dealRoom);
    if (!participants) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.INVALID_ROLE_PAIR, statusCode: 400 }) };
    }
    // Offers are a Negotiation-stage activity only — once the deal advances to Due
    // Diligence (or beyond) the negotiation is frozen for both parties.
    if (dealRoom.stage !== DEAL_ROOM_STAGES.NEGOTIATION) {
        return { error: ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.NOT_NEGOTIATION_STAGE, statusCode: 400 }) };
    }
    return { dealRoom, participants };
};

// Maps the camelCase socket/API payload to the snake_case DB columns.
const toColumns = (formFields) => ({
    currency: formFields.currency,
    investment_amount: formFields.investmentAmount,
    equity_percentage: formFields.equityPercentage,
    valuation_type: formFields.valuationType,
    valid_until: formFields.validUntil,
    terms_conditions: formFields.termsConditions || null,
    supporting_notes: formFields.supportingNotes || null
});

// Step 1a — Investor saves the offer form without sending it. The draft is private
// (never broadcast to the founder) and can be re-saved any number of times by
// passing back its offerId. Only the investor side of the room may hold a draft.
const saveDraft = async ({ dealRoomId, offerId, userId, ...formFields }) => {
    const transaction = await sequelize.transaction();
    try {
        const { error: validationError } = validateOfferPayload({ dealRoomId, offerId, ...formFields });
        if (validationError) {
            await transaction.rollback();
            return ServiceResponse.error({ message: validationError.details.map((d) => d.message), statusCode: 400 });
        }

        const { error, participants } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            await transaction.rollback();
            return error;
        }

        if (participants.investor.userId !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const columns = toColumns(formFields);
        let draft;

        if (offerId) {
            const existing = await dealRoomOfferRepository.findById(offerId);
            if (!existing || existing.deal_room_id !== dealRoomId || existing.offered_by_user_id !== userId ||
                existing.status !== DEAL_ROOM_OFFER_STATUS.DRAFT) {
                await transaction.rollback();
                return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.NOT_FOUND, statusCode: 404 });
            }
            draft = await dealRoomOfferRepository.updateDraft(offerId, { ...columns, updated_by: userId }, { transaction });
        } else {
            draft = await dealRoomOfferRepository.create({
                deal_room_id: dealRoomId,
                offered_by_user_id: participants.investor.userId,
                offered_by_role_id: participants.investor.roleId,
                offered_by_company_id: participants.investor.companyId,
                recipient_user_id: participants.founder.userId,
                recipient_role_id: participants.founder.roleId,
                recipient_company_id: participants.founder.companyId,
                status: DEAL_ROOM_OFFER_STATUS.DRAFT,
                is_counter_offer: false,
                version: 1,
                ...columns,
                created_by: userId
            }, { transaction });
        }

        await transaction.commit();
        return ServiceResponse.success({
            data: draft,
            message: DEAL_ROOM_OFFER_MESSAGES.DRAFT_SAVE_SUCCESS,
            statusCode: offerId ? 200 : 201
        });
    } catch (err) {
        await transaction.rollback();
        errorLogger.error(err);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DRAFT_SAVE_FAILED, statusCode: 500 });
    }
};

// Step 1b — Investor sends the offer: either promotes their existing Draft
// (offerId given) or creates a fresh Pending row directly. This is the root of a
// new negotiation thread, so root_offer_id is set to the row's own id. Blocked if
// any offer in this deal room is still Pending.
const sendOffer = async ({ dealRoomId, offerId, userId, ...formFields }) => {
    const transaction = await sequelize.transaction();
    try {
        const { error: validationError } = validateOfferPayload({ dealRoomId, offerId, ...formFields });
        if (validationError) {
            await transaction.rollback();
            return ServiceResponse.error({ message: validationError.details.map((d) => d.message), statusCode: 400 });
        }

        const { error, participants } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            await transaction.rollback();
            return error;
        }

        if (participants.investor.userId !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const pending = await dealRoomOfferRepository.findPendingByDealRoomId(dealRoomId);
        if (pending) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.PENDING_OFFER_EXISTS, statusCode: 409 });
        }

        const columns = toColumns(formFields);
        let offer;

        if (offerId) {
            const existing = await dealRoomOfferRepository.findById(offerId);
            if (!existing || existing.deal_room_id !== dealRoomId || existing.offered_by_user_id !== userId ||
                existing.status !== DEAL_ROOM_OFFER_STATUS.DRAFT) {
                await transaction.rollback();
                return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.NOT_FOUND, statusCode: 404 });
            }
            await dealRoomOfferRepository.updateDraft(offerId, { ...columns, updated_by: userId }, { transaction });
            offer = await dealRoomOfferRepository.promoteDraftToPending(offerId, { updatedBy: userId, transaction });
        } else {
            offer = await dealRoomOfferRepository.create({
                deal_room_id: dealRoomId,
                offered_by_user_id: participants.investor.userId,
                offered_by_role_id: participants.investor.roleId,
                offered_by_company_id: participants.investor.companyId,
                recipient_user_id: participants.founder.userId,
                recipient_role_id: participants.founder.roleId,
                recipient_company_id: participants.founder.companyId,
                status: DEAL_ROOM_OFFER_STATUS.PENDING,
                is_counter_offer: false,
                version: 1,
                sent_at: new Date(),
                ...columns,
                created_by: userId
            }, { transaction });
        }

        if (!offer.root_offer_id) {
            offer = await dealRoomOfferRepository.setRootOfferId(offer.id, offer.id, { transaction });
        }

        await transaction.commit();
        return ServiceResponse.success({ data: offer, message: DEAL_ROOM_OFFER_MESSAGES.SEND_SUCCESS, statusCode: 200 });
    } catch (err) {
        await transaction.rollback();
        errorLogger.error(err);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.SEND_FAILED, statusCode: 500 });
    }
};

// Step 2a — the recipient of the current Pending offer accepts or rejects it.
// Both outcomes are terminal for the thread. Only the recipient may respond
// (offered_by can never act on their own offer).
const respondOffer = async ({ dealRoomId, offerId, decision, userId }) => {
    const transaction = await sequelize.transaction();
    try {
        if (![DEAL_ROOM_OFFER_STATUS.ACCEPTED, DEAL_ROOM_OFFER_STATUS.REJECTED].includes(decision)) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.INVALID_DECISION, statusCode: 400 });
        }

        const { error } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            await transaction.rollback();
            return error;
        }

        const offer = await dealRoomOfferRepository.findById(offerId);
        if (!offer || offer.deal_room_id !== dealRoomId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        if (offer.status !== DEAL_ROOM_OFFER_STATUS.PENDING) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.OFFER_NOT_PENDING, statusCode: 400 });
        }

        if (offer.recipient_user_id !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.CANNOT_RESPOND_OWN_OFFER, statusCode: 403 });
        }

        const updated = await dealRoomOfferRepository.updateStatus(offerId, {
            status: decision,
            respondedByUserId: userId,
            transaction
        });

        await transaction.commit();
        return ServiceResponse.success({ data: updated, message: DEAL_ROOM_OFFER_MESSAGES.RESPOND_SUCCESS, statusCode: 200 });
    } catch (err) {
        await transaction.rollback();
        errorLogger.error(err);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.RESPOND_FAILED, statusCode: 500 });
    }
};

// Step 2b — the recipient counters instead of accepting/rejecting: the parent
// offer is closed as 'Countered' and a new Pending row is created with the
// direction flipped (counterer becomes offered_by, original sender becomes
// recipient). version increments and root_offer_id keeps the thread together.
// The ball is now in the other party's court and steps 2a/2b repeat.
const counterOffer = async ({ dealRoomId, offerId, userId, ...formFields }) => {
    const transaction = await sequelize.transaction();
    try {
        const { error: validationError } = validateOfferPayload({ dealRoomId, offerId, ...formFields });
        if (validationError) {
            await transaction.rollback();
            return ServiceResponse.error({ message: validationError.details.map((d) => d.message), statusCode: 400 });
        }

        const { error } = await loadEligibleDealRoom(dealRoomId, userId);
        if (error) {
            await transaction.rollback();
            return error;
        }

        const parentOffer = await dealRoomOfferRepository.findById(offerId);
        if (!parentOffer || parentOffer.deal_room_id !== dealRoomId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.NOT_FOUND, statusCode: 404 });
        }

        if (parentOffer.status !== DEAL_ROOM_OFFER_STATUS.PENDING) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.OFFER_NOT_PENDING, statusCode: 400 });
        }

        if (parentOffer.recipient_user_id !== userId) {
            await transaction.rollback();
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.CANNOT_RESPOND_OWN_OFFER, statusCode: 403 });
        }

        await dealRoomOfferRepository.updateStatus(offerId, {
            status: DEAL_ROOM_OFFER_STATUS.COUNTERED,
            respondedByUserId: userId,
            transaction
        });

        const rootOfferId = parentOffer.root_offer_id || parentOffer.id;
        const columns = toColumns(formFields);

        const counter = await dealRoomOfferRepository.create({
            deal_room_id: dealRoomId,
            offered_by_user_id: userId,
            offered_by_role_id: parentOffer.recipient_role_id,
            offered_by_company_id: parentOffer.recipient_company_id,
            recipient_user_id: parentOffer.offered_by_user_id,
            recipient_role_id: parentOffer.offered_by_role_id,
            recipient_company_id: parentOffer.offered_by_company_id,
            parent_offer_id: parentOffer.id,
            root_offer_id: rootOfferId,
            is_counter_offer: true,
            version: parentOffer.version + 1,
            status: DEAL_ROOM_OFFER_STATUS.PENDING,
            sent_at: new Date(),
            ...columns,
            created_by: userId
        }, { transaction });

        await transaction.commit();
        return ServiceResponse.success({ data: counter, message: DEAL_ROOM_OFFER_MESSAGES.COUNTER_SUCCESS, statusCode: 201 });
    } catch (err) {
        await transaction.rollback();
        errorLogger.error(err);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.COUNTER_FAILED, statusCode: 500 });
    }
};

// Full negotiation history: every version in the current thread, oldest first.
const getOfferThread = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }
        if (!dealRoomService.isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const latest = await dealRoomOfferRepository.findLatestByDealRoomId(dealRoomId);
        if (!latest) {
            return ServiceResponse.success({ data: [], message: DEAL_ROOM_OFFER_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
        }

        const thread = await dealRoomOfferRepository.findThreadByRootId(latest.root_offer_id || latest.id);
        return ServiceResponse.success({ data: thread, message: DEAL_ROOM_OFFER_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// Every negotiation thread ever started in this room, oldest first — unlike
// getOfferThread (scoped to just the latest/current thread), this surfaces earlier
// resolved (Accepted/Rejected) threads too, since sendOffer allows starting a fresh
// root offer once the previous thread is no longer Pending.
const getAllOfferThreads = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }
        if (!dealRoomService.isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const offers = await dealRoomOfferRepository.findAllByDealRoomId(dealRoomId);
        return ServiceResponse.success({ data: offers, message: DEAL_ROOM_OFFER_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// The one actionable offer right now: the Pending row if the negotiation is live,
// otherwise the latest row (Accepted/Rejected/Draft) so the UI can show the outcome.
const getCurrentOffer = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }
        if (!dealRoomService.isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const pending = await dealRoomOfferRepository.findPendingByDealRoomId(dealRoomId);
        const current = pending || await dealRoomOfferRepository.findLatestByDealRoomId(dealRoomId);
        return ServiceResponse.success({ data: current, message: DEAL_ROOM_OFFER_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

// The caller's own unsent Draft (if any) so the frontend can prefill the form.
const getDraft = async (dealRoomId, userId) => {
    try {
        const dealRoom = await dealRoomRepository.findById(dealRoomId);
        if (!dealRoom) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.DEAL_ROOM_NOT_FOUND, statusCode: 404 });
        }
        if (!dealRoomService.isParticipant(dealRoom, userId)) {
            return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FORBIDDEN, statusCode: 403 });
        }

        const draft = await dealRoomOfferRepository.findDraftByUserId(dealRoomId, userId);
        return ServiceResponse.success({ data: draft, message: DEAL_ROOM_OFFER_MESSAGES.FETCH_SUCCESS, statusCode: 200 });
    } catch (error) {
        errorLogger.error(error);
        return ServiceResponse.error({ message: DEAL_ROOM_OFFER_MESSAGES.FETCH_FAILED, statusCode: 500 });
    }
};

module.exports = {
    saveDraft,
    sendOffer,
    respondOffer,
    counterOffer,
    getOfferThread,
    getAllOfferThreads,
    getCurrentOffer,
    getDraft
};
