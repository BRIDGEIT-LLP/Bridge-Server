'use strict';
const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const userSessionController = require('../controllers/userSessionController');
const { PERMISSIONS } = require('../utils/constant');

/*
 * ROUTE ORDERING MATTERS — all named routes (/logout, /logout-all,
 * /limit-status, /revoke-selected) must come BEFORE /:sessionId.
 * Express matches top-to-bottom; /:sessionId would otherwise swallow
 * those string paths as param values.
 */

// GET  /api/v1/sessions
router.get('/', authenticate, authorize(PERMISSIONS.SESSION.VIEW_ACTIVE), userSessionController.getActiveSessions);

// GET  /api/v1/sessions/limit-status
router.get('/limit-status', authenticate, authorize(PERMISSIONS.SESSION.VIEW_LIMIT_STATUS), userSessionController.getSessionLimitStatus);

// POST /api/v1/sessions/logout  — sidebar Logout button (current device only)
router.post('/logout', authenticate, authorize(PERMISSIONS.SESSION.LOGOUT), userSessionController.logoutCurrentSession);

// POST /api/v1/sessions/logout-all  — revoke every session for this user
router.post('/logout-all', authenticate, authorize(PERMISSIONS.SESSION.LOGOUT_ALL), userSessionController.logoutAllSessions);

// POST /api/v1/sessions/revoke-selected  — device-chooser modal selection
router.post('/revoke-selected', authenticate, authorize(PERMISSIONS.SESSION.REVOKE_SELECTED), userSessionController.revokeSelectedSessions);

// DELETE /api/v1/sessions/:sessionId  — revoke one specific session by id
router.delete('/:sessionId', authenticate, authorize(PERMISSIONS.SESSION.REVOKE), userSessionController.revokeSession);

module.exports = router;

/**
 * Mounted in app.js as:
 *   app.use('/api/v1/sessions', userSessionRoutes);
 *
 * Full endpoint list:
 *   GET    /api/v1/sessions
 *   GET    /api/v1/sessions/limit-status
 *   POST   /api/v1/sessions/logout
 *   POST   /api/v1/sessions/logout-all
 *   POST   /api/v1/sessions/revoke-selected
 *   DELETE /api/v1/sessions/:sessionId
 */