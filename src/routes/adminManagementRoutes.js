'use strict';
const express = require('express');
const router = express.Router();

const superAdminMiddleware = require('../middleware/superAdminMiddleware');
const authorize = require('../middleware/authorize');
const adminManagementController = require('../controllers/adminManagementController');
const { validate, createAdminSchema, updateAdminSchema, adminActionSchema } = require('../validations/adminManagementValidation');
const { PERMISSIONS } = require('../utils/constant');

// GET /api/v1/admin/management/admins?page=1&limit=10&status=ACTIVE&search=john
router.get('/admins', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.LIST), adminManagementController.getAdminList);

// GET /api/v1/admin/management/admins/:adminId
router.get('/admins/:adminId', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.VIEW), adminManagementController.getAdminDetail);

// POST /api/v1/admin/management/admins
router.post('/admins', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.CREATE), validate(createAdminSchema), adminManagementController.createAdmin);

// PUT /api/v1/admin/management/admins/:adminId  — profile fields and/or permissions
router.put('/admins/:adminId', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.UPDATE), validate(updateAdminSchema), adminManagementController.updateAdmin);

// DELETE /api/v1/admin/management/admins/:adminId   — reason required in body
router.delete('/admins/:adminId', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.DELETE), validate(adminActionSchema), adminManagementController.deleteAdmin);

// PATCH /api/v1/admin/management/admins/:adminId/suspend
router.patch('/admins/:adminId/suspend', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.SUSPEND), validate(adminActionSchema), adminManagementController.suspendAdmin);

// PATCH /api/v1/admin/management/admins/:adminId/activate
router.patch('/admins/:adminId/activate', superAdminMiddleware, authorize(PERMISSIONS.ADMIN_MANAGEMENT.ACTIVATE), validate(adminActionSchema), adminManagementController.activateAdmin);

module.exports = router;