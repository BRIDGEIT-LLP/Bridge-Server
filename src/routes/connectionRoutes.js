'use strict';

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const connectionController = require('../controllers/connectionController');
const { validate, sendConnectionRequestSchema, changeStatusSchema } = require('../validations/connectionValidation');
const { PERMISSIONS } = require('../utils/constant');

// POST /api/v1/connections — send a connection request
router.post('/', authMiddleware, authorize(PERMISSIONS.CONNECTION.SEND_REQUEST), validate(sendConnectionRequestSchema), connectionController.sendConnectionRequest);

// PUT /api/v1/connections/change-status — change status of a connection request
router.put('/change-status', authMiddleware, authorize(PERMISSIONS.CONNECTION.CHANGE_STATUS), validate(changeStatusSchema), connectionController.changeConnectionStatus);

// GET /api/v1/connections/sent — connection requests sent by logged in user
router.get('/sent', authMiddleware, authorize(PERMISSIONS.CONNECTION.VIEW_SENT), connectionController.getSentConnections);

// GET /api/v1/connections/received — connection requests received by logged in user
router.get('/received', authMiddleware, authorize(PERMISSIONS.CONNECTION.VIEW_RECEIVED), connectionController.getReceivedConnections);

module.exports = router;
