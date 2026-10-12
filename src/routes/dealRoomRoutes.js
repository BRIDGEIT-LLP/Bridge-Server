'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const dealRoomController = require('../controllers/dealRoomController');
const dealRoomOfferController = require('../controllers/dealRoomOfferController');
const dealRoomTermSheetController = require('../controllers/dealRoomTermSheetController');
const dealRoomExportController = require('../controllers/dealRoomExportController');
const { validate, closeDealRoomSchema } = require('../validations/dealRoomValidation');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/deal-rooms?archived=true — list deal rooms for the logged in user (active by default, archived if ?archived=true)
router.get('/', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.VIEW_LIST), dealRoomController.getDealRooms);

// PUT /api/v1/deal-rooms/:dealRoomId/close — close a deal room
router.put('/:dealRoomId/close', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.CLOSE), validate(closeDealRoomSchema), dealRoomController.closeDealRoom);

// PUT /api/v1/deal-rooms/:dealRoomId/archive — archive a deal room (caller's own view only)
router.put('/:dealRoomId/archive', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.ARCHIVE), dealRoomController.archiveDealRoom);

// PUT /api/v1/deal-rooms/:dealRoomId/unarchive — unarchive a deal room (caller's own view only)
router.put('/:dealRoomId/unarchive', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.UNARCHIVE), dealRoomController.unarchiveDealRoom);

// GET /api/v1/deal-rooms/:dealRoomId/stage-request/pending — the room's currently pending stage request (if any)
router.get('/:dealRoomId/stage-request/pending', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.VIEW_PENDING_STAGE_REQUEST), dealRoomController.getPendingStageUpdate);


// GET /api/v1/deal-rooms/:dealRoomId/term-sheet/current — the room's latest B2B term sheet version
router.get('/:dealRoomId/term-sheet/current', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_TERM_SHEET.VIEW_CURRENT), dealRoomTermSheetController.getCurrentTermSheet);

// GET /api/v1/deal-rooms/:dealRoomId/term-sheet/history — every saved B2B term sheet version
router.get('/:dealRoomId/term-sheet/history', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_TERM_SHEET.VIEW_HISTORY), dealRoomTermSheetController.getTermSheetHistory);

// GET /api/v1/deal-rooms/:dealRoomId/offers — full funding offer negotiation thread
router.get('/:dealRoomId/offers', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_OFFER.VIEW_THREAD), dealRoomOfferController.getOfferThread);

// GET /api/v1/deal-rooms/:dealRoomId/offers/all — every negotiation thread ever started in this room
router.get('/:dealRoomId/offers/all', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_OFFER.VIEW_ALL), dealRoomOfferController.getAllOffers);

// GET /api/v1/deal-rooms/:dealRoomId/offers/current — latest offer in the thread
router.get('/:dealRoomId/offers/current', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_OFFER.VIEW_CURRENT), dealRoomOfferController.getCurrentOffer);

// GET /api/v1/deal-rooms/:dealRoomId/offers/draft — caller's own unsent draft, if any
router.get('/:dealRoomId/offers/draft', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM_OFFER.VIEW_DRAFT), dealRoomOfferController.getDraft);

// GET /api/v1/deal-rooms/:dealRoomId/export — download chats + media as a stage-organized zip
router.get('/:dealRoomId/export', authMiddleware, authorize(PERMISSIONS.DEAL_ROOM.EXPORT), dealRoomExportController.exportDealRoom);

module.exports = router;
