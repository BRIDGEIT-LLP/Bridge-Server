'use strict';

const cookie = require('cookie');
const { errorLogger } = require('../configs/logger');
const { verifyAccessToken, COOKIE_NAMES } = require('../utils/token');
const { ROLES } = require('../utils/constant');
const registerChatHandlers = require('./chatSocketHandler');
const registerDealRoomStageHandlers = require('./dealRoomStageSocketHandler');

const registerOfferHandlers = require('./offerSocketHandler');
const registerTermSheetHandlers = require('./termSheetSocketHandler');

const { dealRoomChannel } = require('./dealRoomChannel');

let ioInstance = null;

const authenticateSocket = (socket, next) => {
    try {
        // The access token is an httpOnly cookie now — the client can't read it to put
        // in socket.handshake.auth, so it rides along on the handshake's Cookie header
        // instead (client connects with { withCredentials: true }).
        const rawCookieHeader = socket.handshake.headers.cookie;
        const token = rawCookieHeader && cookie.parse(rawCookieHeader)[COOKIE_NAMES.ACCESS_TOKEN];
        if (!token) {
            // No Cookie header at all usually means the CORS/credentials handshake
            // rejected the request before the cookie could ride along — logging the
            // origin here is the fastest way to tell a CORS rejection apart from a
            // genuinely logged-out user.
            errorLogger.error(
                `Socket auth rejected: no access_token cookie present (origin: ${socket.handshake.headers.origin || 'none'}, had Cookie header: ${!!rawCookieHeader})`
            );
            return next(new Error('Unauthorized'));
        }

        const decoded = verifyAccessToken(token);
        if (!ROLES.USER.includes(decoded.role)) {
            errorLogger.error(`Socket auth rejected: role '${decoded.role}' not permitted`);
            return next(new Error('Forbidden'));
        }

        socket.userId = decoded.userId;
        socket.roleId = decoded.roleId;
        socket.companyId = decoded.companyId;
        socket.role = decoded.role;
        next();
    } catch (error) {
        // Covers jwt.verify failures (expired/invalid/wrong-secret token) — log the
        // real reason (error.name is 'TokenExpiredError'/'JsonWebTokenError'/etc.)
        // instead of only ever returning a generic 'Unauthorized'.
        errorLogger.error(`Socket auth rejected: ${error.name || 'Error'} — ${error.message}`);
        next(new Error('Unauthorized'));
    }
};

const initSockets = (io) => {
    ioInstance = io;

    io.use(authenticateSocket);

    io.on('connection', (socket) => {
        registerChatHandlers(io, socket);
        registerDealRoomStageHandlers(io, socket);
        registerOfferHandlers(io, socket);
        registerTermSheetHandlers(io, socket);
    });
};

const emitToDealRoom = (dealRoomId, event, payload) => {
    if (!ioInstance) {
        errorLogger.error(new Error('emitToDealRoom called before sockets were initialized'));
        return;
    }
    ioInstance.to(dealRoomChannel(dealRoomId)).emit(event, payload);
};

module.exports = { initSockets, emitToDealRoom };
