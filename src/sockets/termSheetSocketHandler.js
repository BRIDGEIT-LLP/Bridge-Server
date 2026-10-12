'use strict';

/**
 * Real-time transport for the B2B collaborative Term Sheet — mirrors the Funding
 * Offer split: GET reads live over REST (dealRoomTermSheetController), only the
 * write goes over the socket.
 *
 * Event pair:
 *   update_term_sheet -> term_sheet_updated   (broadcast to the whole deal room)
 *
 * All validation/authorization lives in dealRoomTermSheetService — this file only
 * guards for missing keys, forwards socket.userId, and relays the result. Failures go
 * back to the emitting socket only, as an 'error' event.
 */

const { errorLogger } = require('../configs/logger');
const dealRoomTermSheetService = require('../services/dealRoomTermSheetService');
const { dealRoomChannel } = require('./dealRoomChannel');
const { SOCKET_EVENTS } = require('../utils/constant');

const registerTermSheetSocketHandlers = (io, socket) => {

    const emitError = (message) => {
        socket.emit(SOCKET_EVENTS.ERROR, { message });
    };

    socket.on(SOCKET_EVENTS.UPDATE_TERM_SHEET, async (payload = {}) => {
        try {
            const { dealRoomId } = payload;
            if (!dealRoomId) {
                return emitError('dealRoomId is required');
            }

            const result = await dealRoomTermSheetService.updateTermSheet({ ...payload, userId: socket.userId });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.TERM_SHEET_UPDATED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to save the term sheet');
        }
    });
};

module.exports = registerTermSheetSocketHandlers;
