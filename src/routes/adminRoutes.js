'use strict';
const express = require('express');
const Joi = require('joi');
const router = express.Router();

const adminMiddleware = require('../middleware/adminMiddleware');
const adminMfaMiddleware = require('../middleware/adminMfaMiddleware');
const authorize = require('../middleware/authorize');
const adminController = require('../controllers/adminController');
const adminSessionController = require('../controllers/adminSessionController');
const dashboardController = require('../controllers/dashboardController');
const faqController = require('../controllers/faqController');
const adminManagementRoutes = require('./adminManagementRoutes');
const { PERMISSIONS } = require('../utils/constant');

// ─── Validation Schemas ────────────────────────────────────────────────────────

const validateRevokeSelectedSessions = (req, res, next) => {
    const schema = Joi.object({
        sessionIds: Joi.array()
            .items(Joi.string().uuid())
            .min(1)
            .required()
            .messages({
                'array.base': 'sessionIds must be an array',
                'array.min': 'At least one session must be selected',
                'string.guid': 'Each session ID must be a valid UUID'
            })
    });

    const { error } = schema.validate(req.body, { abortEarly: false });
    if (error) {
        return res.status(400).json({
            message: error.details.map(d => d.message).join(', '),
            statusCode: 400
        });
    }

    next();
};

/**
 * Validates that :sessionId route param is a well-formed UUID before it
 * reaches the service/repository layer. Prevents Sequelize from throwing a
 * cast error on malformed input and returns a clean 400 instead of a 500.
 */
const validateSessionIdParam = (req, res, next) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(req.params.sessionId)) {
        return res.status(400).json({
            message: 'sessionId must be a valid UUID',
            statusCode: 400
        });
    }
    next();
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

router.post('/auth/login', adminController.login);

router.post('/auth/mfa/trigger-otp', adminMfaMiddleware, authorize(PERMISSIONS.ADMIN_AUTH.MFA_TRIGGER_OTP), adminController.triggerOtp);

router.post('/auth/mfa/verify-otp', adminMfaMiddleware, authorize(PERMISSIONS.ADMIN_AUTH.MFA_VERIFY_OTP), adminController.verifyMfaOtp);

router.post('/auth/mfa/resend-otp', adminMfaMiddleware, authorize(PERMISSIONS.ADMIN_AUTH.MFA_RESEND_OTP), adminController.resendMfaOtp);

router.post('/auth/logout', adminMiddleware, authorize(PERMISSIONS.SESSION.LOGOUT), adminController.logout);

// ─── Dashboard ────────────────────────────────────────────────────────────────

// GET /api/v1/admin/dashboard
router.get('/dashboard', adminMiddleware, authorize(PERMISSIONS.ADMIN_DASHBOARD.VIEW), dashboardController.getAdminDashboard);

// ─── Session management (admin_session table) ─────────────────────────────────
//
// No authorize() here — session operations are personal (every admin manages only
// their own sessions) so adminMiddleware's JWT + userType check is sufficient.
// The SESSION.* permissions were seeded for user flows; not all of them (e.g.
// REVOKE_SELECTED) are seeded for the ADMIN userType, so adding authorize() would
// 403 on those routes even with a valid token.
//
// ROUTE ORDERING MATTERS — all named routes (/limit-status, /logout, /logout-all,
// /revoke-selected) must come BEFORE /:sessionId. Express matches top-to-bottom;
// /:sessionId would otherwise swallow those string paths as param values.

// GET  /api/v1/admin/sessions
router.get('/sessions', adminMiddleware, adminSessionController.listSessions);

// GET  /api/v1/admin/sessions/limit-status  — called by frontend after OTP verify
router.get('/sessions/limit-status', adminMiddleware, adminSessionController.getSessionLimitStatus);

// POST /api/v1/admin/sessions/logout  — used by AuthProvider.logout for admin/super_admin
router.post('/sessions/logout', adminMiddleware, adminSessionController.logoutCurrentSession);

// POST /api/v1/admin/sessions/logout-all
router.post('/sessions/logout-all', adminMiddleware, adminSessionController.logoutAllSessions);

// POST /api/v1/admin/sessions/revoke-selected  — device-chooser modal selection
router.post('/sessions/revoke-selected', adminMiddleware, validateRevokeSelectedSessions, adminSessionController.revokeSelectedSessions);

// DELETE /api/v1/admin/sessions/:sessionId  — revoke one specific session by id
router.delete('/sessions/:sessionId', adminMiddleware, validateSessionIdParam, adminSessionController.revokeOneSession);

// ─── Admin / Super-Admin Self-Service Profile ─────────────────────────────────
//
// No authorize() — profile operations are personal (every admin reads/updates only
// their own record) so adminMiddleware's JWT + userType check is sufficient.
// Mirrors the session-management pattern above.

// GET  /api/v1/admin/profile  — fetch the signed-in admin's own profile fields
router.get('/profile', adminMiddleware, adminController.getAdminProfile);

// PUT  /api/v1/admin/profile  — update editable fields (name, country_code, mobile_number)
router.put('/profile', adminMiddleware, adminController.updateAdminProfile);

// ─── Users ────────────────────────────────────────────────────────────────────

router.get('/get-user-list', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.LIST), adminController.getUserList);

router.get('/users/switched-roles', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.SWITCHED_ROLE_LIST), adminController.getSwitchedRoleUsers);

router.get('/users/role-switch-details', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.SWITCHED_ROLE_LIST), adminController.getRoleSwitchUserDetails);

router.get('/users/:userId', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.VIEW_DETAIL), adminController.getUserDetail);

router.get('/get-user-kyc_docs', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.VIEW_KYC_DOCS), adminController.getUserKycDocs);

router.put('/users/suspension', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.SUSPENSION_ACTION), adminController.updateUserSuspension);

router.put('/users/role-switch-action', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER.SWITCH_ROLE_ACTION), adminController.updateRoleSwitchStatus);

router.put('/kyc/document-action', adminMiddleware, authorize(PERMISSIONS.ADMIN_KYC.DOCUMENT_ACTION), adminController.kycDocumentAction);

router.put('/kyc/review-action', adminMiddleware, authorize(PERMISSIONS.ADMIN_KYC.REVIEW_ACTION), adminController.kycReviewAction);

// User limit config
router.get('/users/:userId/limit-config', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER_LIMIT.VIEW), adminController.getUserLimitConfig);

router.put('/users/:userId/limit-config', adminMiddleware, authorize(PERMISSIONS.ADMIN_USER_LIMIT.UPDATE), adminController.updateUserLimitConfig);

// ─── FAQ management ───────────────────────────────────────────────────────────

router.get('/faqs', adminMiddleware, authorize(PERMISSIONS.ADMIN_FAQ.LIST), faqController.getAllFaqsForAdmin);

router.post('/faqs', adminMiddleware, authorize(PERMISSIONS.ADMIN_FAQ.CREATE), faqController.createFaq);

router.put('/faqs/:id', adminMiddleware, authorize(PERMISSIONS.ADMIN_FAQ.UPDATE), faqController.updateFaq);

// ─── Matching Engine Dashboard ────────────────────────────────────────────────

// TODO: add permission for this route
router.get('/matching-engine/stats', adminMiddleware, adminController.getMatchingEngineStats);

// ─── Super Admin — Admin Management ──────────────────────────────────────────

router.use('/management', adminManagementRoutes);

module.exports = router;
