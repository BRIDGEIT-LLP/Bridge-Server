'use strict';
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const dashboardController = require('../controllers/dashboardController');
const businessCheckController = require('../controllers/businessCheckController');
const { validate } = require('../validations/authValidation');
const { businessCheckSchema } = require('../validations/businessCheckValidation');
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/users/dashboard — role-specific stat cards for the user dashboard
router.get('/dashboard', authMiddleware, authorize(PERMISSIONS.USER.VIEW_DASHBOARD), dashboardController.getUserDashboard);

// POST /api/v1/users — create a user profile (requires valid JWT)
router.post('/build-profile', authMiddleware, authorize(PERMISSIONS.USER.BUILD_PROFILE), userController.createUserProfile);

// GET /api/v1/users/profile — get user profile structure with editability configs
router.get('/profile', authMiddleware, authorize(PERMISSIONS.USER.VIEW_PROFILE), userController.getUserProfile);

router.put('/profile', authMiddleware, authorize(PERMISSIONS.USER.UPDATE_PROFILE), userController.updateUserProfile);

// PUT /api/v1/users/business-check — "Check your business" onboarding step; what is accepted depends on the role.
// Reuses the FILE.SAVE_KYC_INFO permission (same registration-KYC stage) so no new permission seed is needed.
router.put('/business-check', authMiddleware, authorize(PERMISSIONS.FILE.SAVE_KYC_INFO), validate(businessCheckSchema), businessCheckController.saveBusinessCheck);

// GET /api/v1/users/business-check — returns what PUT /business-check stored (PAN decrypted), for prefilling the step
router.get('/business-check', authMiddleware, authorize(PERMISSIONS.FILE.SAVE_KYC_INFO), businessCheckController.getBusinessCheck);

// GET /api/v1/users/search?q=<query> — search user profiles by email, first name, last name
router.get('/search', authMiddleware, authorize(PERMISSIONS.USER.SEARCH), userController.searchUsers);

// GET /api/v1/users/role-details?userId=<id> — get role-specific field details for a given user
router.get('/role-details', authMiddleware, authorize(PERMISSIONS.USER.VIEW_ROLE_DETAILS), userController.getUserRoleDetails);

module.exports = router;
