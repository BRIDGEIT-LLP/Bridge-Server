'use strict';

const express = require('express');
const router = express.Router({ mergeParams: true });
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const chatController = require('../controllers/chatController');
const { chatMediaUpload } = require('../configs/scan');
const { validate, sendMediaMessageSchema } = require('../validations/chatValidation');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/deal-rooms/:dealRoomId/messages — full message history
router.get('/', authMiddleware, authorize(PERMISSIONS.CHAT.VIEW_MESSAGES), chatController.getMessages);

// PUT /api/v1/deal-rooms/:dealRoomId/messages/read — mark messages as read
router.put('/read', authMiddleware, authorize(PERMISSIONS.CHAT.MARK_READ), chatController.markRead);

// POST /api/v1/deal-rooms/:dealRoomId/messages/media — upload an image/document/audio/video message
// router.post('/media', authMiddleware, authorize(PERMISSIONS.CHAT.UPLOAD_MEDIA), chatMediaUpload.single('media'), validate(sendMediaMessageSchema), chatController.uploadMedia);
router.post('/media', authMiddleware, authorize(PERMISSIONS.CHAT.UPLOAD_MEDIA), chatMediaUpload.single('media'), chatController.uploadMedia);

// GET /api/v1/deal-rooms/:dealRoomId/messages/media — list shared files/attachments in the deal room
router.get('/media', authMiddleware, authorize(PERMISSIONS.CHAT.VIEW_SHARED_FILES), chatController.getSharedFiles);

// GET /api/v1/deal-rooms/:dealRoomId/messages/:messageId/media — stream a previously uploaded attachment
router.get('/:messageId/media', authMiddleware, authorize(PERMISSIONS.CHAT.VIEW_MEDIA), chatController.getMedia);

module.exports = router;
