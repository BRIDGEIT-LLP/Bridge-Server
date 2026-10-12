'use strict';

/**
 * Real-time transport for the Structured Funding Offer flow.
 *
 * Clients must already be authenticated (JWT handshake in sockets/index.js) and
 * joined to the deal room channel via JOIN_DEAL_ROOM before these events matter.
 *
 * Event pairs (client emits -> server broadcasts to the deal room channel):
 *   save_offer_draft -> offer_draft_saved   (ack to the sender only — drafts are private)
 *   send_offer       -> offer_received      (founder is alerted the moment it's sent)
 *   respond_offer    -> offer_responded     (accept/reject outcome, both parties see it)
 *   counter_offer    -> offer_countered     (new pending version, direction flipped)
 *
 * All validation/authorization lives in dealRoomOfferService — this file only
 * guards for missing keys, forwards socket.userId, and relays the result.
 * Failures go back to the emitting socket only, as an 'error' event.
 */

const { errorLogger } = require('../configs/logger');
const dealRoomOfferService = require('../services/dealRoomOfferService');
const { dealRoomChannel } = require('./dealRoomChannel');
const { SOCKET_EVENTS } = require('../utils/constant');

const registerOfferSocketHandlers = (io, socket) => {

    const emitError = (message) => {
        socket.emit(SOCKET_EVENTS.ERROR, { message });
    };

    socket.on(SOCKET_EVENTS.SAVE_OFFER_DRAFT, async (payload = {}) => {
        try {
            const { dealRoomId } = payload;
            if (!dealRoomId) {
                return emitError('dealRoomId is required');
            }

            const result = await dealRoomOfferService.saveDraft({ ...payload, userId: socket.userId });

            if (!result.success) {
                return emitError(result.message);
            }

            // Draft is private to the investor editing it — ack the sender only, no room broadcast.
            socket.emit(SOCKET_EVENTS.OFFER_DRAFT_SAVED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to save offer draft');
        }
    });

    socket.on(SOCKET_EVENTS.SEND_OFFER, async (payload = {}) => {
        try {
            const { dealRoomId } = payload;
            if (!dealRoomId) {
                return emitError('dealRoomId is required');
            }

            const result = await dealRoomOfferService.sendOffer({ ...payload, userId: socket.userId });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.OFFER_RECEIVED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to send offer');
        }
    });

    socket.on(SOCKET_EVENTS.RESPOND_OFFER, async ({ dealRoomId, offerId, decision } = {}) => {
        try {
            if (!dealRoomId || !offerId || !decision) {
                return emitError('dealRoomId, offerId and decision are required');
            }

            const result = await dealRoomOfferService.respondOffer({
                dealRoomId,
                offerId,
                decision,
                userId: socket.userId
            });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.OFFER_RESPONDED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to respond to offer');
        }
    });

    socket.on(SOCKET_EVENTS.COUNTER_OFFER, async (payload = {}) => {
        try {
            const { dealRoomId, offerId } = payload;
            if (!dealRoomId || !offerId) {
                return emitError('dealRoomId and offerId are required');
            }

            const result = await dealRoomOfferService.counterOffer({ ...payload, userId: socket.userId });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.OFFER_COUNTERED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to send counter offer');
        }
    });
};

module.exports = registerOfferSocketHandlers;
