'use strict';

const express = require('express');
const router = express.Router();
const faqController = require('../controllers/faqController');
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/faqs — fetch all active FAQs (requires valid JWT)
router.get('/', authMiddleware, authorize(PERMISSIONS.FAQ.VIEW), faqController.getFaqs);

module.exports = router;