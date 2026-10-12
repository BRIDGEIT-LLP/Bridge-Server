'use strict';

const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');
const authMiddleware = require('../middleware/authMiddleware');
const authorize = require('../middleware/authorize');
const { createMeetingSchema, updateMeetingSchema, validate } = require('../validations/meetingValidation');
const { PERMISSIONS } = require('../utils/constant');

// POST /api/v1/meetings
// Create a new meeting. Meeting is confirmed immediately upon creation.
router.post(
    '/',
    authMiddleware,
    authorize(PERMISSIONS.MEETING.CREATE),
    validate(createMeetingSchema),
    meetingController.createMeeting
);

// GET /api/v1/meetings/upcoming?dealRoomId=<uuid>
// Returns the single nearest upcoming meeting for the specified deal room.
router.get('/upcoming', authMiddleware, authorize(PERMISSIONS.MEETING.VIEW_UPCOMING), meetingController.getUpcomingMeeting);

// GET /api/v1/meetings/detail?meetingId=1
// Returns full details of a single meeting.
router.get('/detail', authMiddleware, authorize(PERMISSIONS.MEETING.VIEW_DETAIL), meetingController.getMeetingById);

// GET /api/v1/meetings?dealRoomId=<uuid>
// Returns ALL meetings (past + upcoming) for the specified deal room.
router.get('/', authMiddleware, authorize(PERMISSIONS.MEETING.VIEW_LIST), meetingController.getMeetingsByDealRoom);

// PUT /api/v1/meetings/update?meetingId=1
// Updates meeting details. At least one field must be provided.
router.put(
    '/update',
    authMiddleware,
    authorize(PERMISSIONS.MEETING.UPDATE),
    validate(updateMeetingSchema),
    meetingController.updateMeeting
);

module.exports = router;