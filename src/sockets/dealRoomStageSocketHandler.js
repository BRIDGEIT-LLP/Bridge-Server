'use strict';

const { errorLogger } = require('../configs/logger');
const dealRoomService = require('../services/dealRoomService');
const { dealRoomChannel } = require('./dealRoomChannel');
const { SOCKET_EVENTS } = require('../utils/constant');

const registerDealRoomStageHandlers = (io, socket) => {

    const emitError = (message) => {
        socket.emit(SOCKET_EVENTS.ERROR, { message });
    };

    socket.on(SOCKET_EVENTS.REQUEST_STAGE_UPDATE, async ({ dealRoomId, requestedStage } = {}) => {
        try {
            if (!dealRoomId || !requestedStage) {
                return emitError('dealRoomId and requestedStage are required');
            }

            const result = await dealRoomService.requestStageUpdate({
                dealRoomId,
                requestedStage,
                requestedByUserId: socket.userId,
                requestedByRoleId: socket.roleId
            });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.STAGE_UPDATE_REQUESTED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to request stage update');
        }
    });

    socket.on(SOCKET_EVENTS.RESPOND_STAGE_UPDATE, async ({ dealRoomId, requestId, decision } = {}) => {
        try {
            if (!dealRoomId || !requestId || !decision) {
                return emitError('dealRoomId, requestId and decision are required');
            }

            const result = await dealRoomService.respondStageUpdate({
                dealRoomId,
                requestId,
                decision,
                respondedByUserId: socket.userId
            });

            if (!result.success) {
                return emitError(result.message);
            }

            io.to(dealRoomChannel(dealRoomId)).emit(SOCKET_EVENTS.STAGE_UPDATE_RESPONDED, result.data);
        } catch (error) {
            errorLogger.error(error);
            emitError('Unable to respond to stage update request');
        }
    });
};

module.exports = registerDealRoomStageHandlers;
