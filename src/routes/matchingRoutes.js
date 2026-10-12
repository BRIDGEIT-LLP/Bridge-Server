'use strict';

const express = require('express');
const router = express.Router();
const matchingController = require('../matching/matchingController');
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/matching/profiles — get ranked matches for a profile
router.get('/profiles', authMiddleware, authorize(PERMISSIONS.MATCHING.VIEW_PROFILES), matchingController.getMatches);

module.exports = router;
