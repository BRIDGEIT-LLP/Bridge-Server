'use strict';
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const {
    validate,
    companyRegistrationSchema,
    verifyGstSchema,
    verifyCinSchema,
    verifyOtpSchema,
    resendOtpSchema,
    refreshTokenSchema,
    loginSchema,
    resetPasswordSchema,
    switchRoleSchema,
    requestRoleSwitchSchema
} = require('../validations/authValidation');
const authMiddleware = require('../middleware/authMiddleware');
const mfaMiddleware = require('../middleware/mfaMiddleware');
const authorize = require('../middleware/authorize');
const resetPasswordMiddleware = require('../middleware/resetPasswordMiddleware');
const { PERMISSIONS } = require('../utils/constant');


// Route for starting Company registration and generating OTPs
router.post('/company-registration', validate(companyRegistrationSchema), authController.companyRegistration);

// Route for checking a GSTIN against sandbox.co.in — called by the frontend when the
// GST field loses focus, before the full registration form is submitted. Public
// (no authMiddleware) since it runs before any account exists; the same check is
// re-run server-side inside company-registration so it can't be bypassed.
router.post('/verify-gst', validate(verifyGstSchema), authController.verifyGst);

// Route for checking a CIN — mirrors /verify-gst. Currently backed by a fixed mock
// response pending a real CIN verification API (see cinVerificationService.js).
router.post('/verify-cin', validate(verifyCinSchema), authController.verifyCin);

// Route for verifying a single channel OTP
router.post('/verify-otp', mfaMiddleware, authorize(PERMISSIONS.AUTH.VERIFY_OTP), validate(verifyOtpSchema), authController.verifyOtp);

// Route for resending an OTP for a channel
router.post('/resend-otp', mfaMiddleware, authorize(PERMISSIONS.AUTH.RESEND_OTP), validate(resendOtpSchema), authController.resendOtp);

// Route for updating access tokens via refresh tokens
router.post('/refresh', validate(refreshTokenSchema), authController.updateAccessToken);

// Route for company login
router.post('/login', validate(loginSchema), authController.login);

// Route for triggering OTP (MFA) — guarded by the pre-MFA token, not the app token
router.post('/mfa/trigger-otp', mfaMiddleware, authorize(PERMISSIONS.AUTH.MFA_TRIGGER_OTP), authController.triggerOtp);

router.post('/mfa/verify-otp', mfaMiddleware, authorize(PERMISSIONS.AUTH.MFA_VERIFY_OTP), authController.verifyMfaOtp);

router.post('/mfa/resend-otp', mfaMiddleware, authorize(PERMISSIONS.AUTH.MFA_RESEND_OTP), authController.resendMfaOtp);

router.post('/reset-password/trigger-otp', authController.resetPasswordTriggerOtp);

router.post('/reset-password/verify-otp', authController.resetPasswordVerifyOtp);

router.post('/reset-password', resetPasswordMiddleware, validate(resetPasswordSchema), authController.resetPassword);

// Fetch the target role's filled/unfilled registration fields. Read-only —
// does not insert into company_user_role.
router.get('/switch-role-details', authMiddleware, authorize(PERMISSIONS.AUTH.SWITCH_ROLE), validate(switchRoleSchema, 'query'), authController.getSwitchRoleDetails);

// Save target-role profile fields and create a pending company_user_role
// with is_profile_completed=true so an admin can approve or reject it.
router.post('/request-role-switch', authMiddleware, authorize(PERMISSIONS.AUTH.SWITCH_ROLE), validate(requestRoleSwitchSchema), authController.requestRoleSwitch);

// Switch the active session into an already-approved role (re-issues tokens).
router.post('/switch-role', authMiddleware, authorize(PERMISSIONS.AUTH.SWITCH_ROLE), validate(switchRoleSchema), authController.switchRole);

module.exports = router;
