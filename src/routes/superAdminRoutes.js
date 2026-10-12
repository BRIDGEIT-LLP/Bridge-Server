'use strict';
const express = require('express');
const router = express.Router();

const adminConfigController = require('../controllers/adminConfigController');
const dashboardController = require('../controllers/dashboardController');
const adminMiddleware = require('../middleware/adminMiddleware');
const authorize = require('../middleware/authorize');
const { validate, updateTrialConfigSchema } = require('../validations/trialConfigValidation');
const { PERMISSIONS } = require('../utils/constant');

// ─── Dashboard ────────────────────────────────────────────────────────────────

// GET /api/v1/super-admin/dashboard
router.get('/dashboard', adminMiddleware, authorize(PERMISSIONS.SUPER_ADMIN_DASHBOARD.VIEW), dashboardController.getSuperAdminDashboard);

// ─── System Configuration ─────────────────────────────────────────────────────

router.get('/config/otp-config', adminMiddleware, authorize(PERMISSIONS.ADMIN_CONFIG.VIEW_OTP_CONFIG), adminConfigController.getOtpConfig);

router.put('/config/otp-config', adminMiddleware, authorize(PERMISSIONS.ADMIN_CONFIG.UPDATE_OTP_CONFIG), adminConfigController.updateOtpConfig);

// TODO: add authorize(PERMISSIONS.ADMIN_CONFIG.VIEW_TRIAL_CONFIG / UPDATE_TRIAL_CONFIG) once the permissions are seeded
router.get('/config/trial-config', adminMiddleware, adminConfigController.getTrialConfig);

router.put('/config/trial-config', adminMiddleware, validate(updateTrialConfigSchema), adminConfigController.updateTrialConfig);

router.put('/config/otp-config/reset', adminMiddleware, authorize(PERMISSIONS.ADMIN_CONFIG.RESET_OTP_CONFIG), adminConfigController.resetOtpConfig);

module.exports = router;
