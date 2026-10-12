'use strict';

const express = require('express');
const router = express.Router();

const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utils/constant');
const subscriptionController = require('../controllers/subscriptionController');

// GET /api/v1/subscriptions/plans — list all active plans (requires valid JWT)
router.get('/plans', authMiddleware, authorize(PERMISSIONS.SUBSCRIPTION.VIEW_PLANS), subscriptionController.getPlans);

// POST /api/v1/subscriptions/select — select a plan for the authenticated user
// Body: { plan_id: number }
router.post('/select', authMiddleware, authorize(PERMISSIONS.SUBSCRIPTION.SELECT_PLAN), subscriptionController.selectPlan);

// GET /api/v1/subscriptions/my — fetch the authenticated user's active subscription
router.get('/my', authMiddleware, authorize(PERMISSIONS.SUBSCRIPTION.VIEW_MY_SUBSCRIPTION), subscriptionController.getUserSubscription);

module.exports = router;