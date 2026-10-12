'use strict';

const { Meeting, DealRoom, User } = require('../models');  // User added
const { Op } = require('sequelize');

// ─── Deal Room ────────────────────────────────────────────────────────────────

const getDealRoomById = async (dealRoomId) => {
    return await DealRoom.findOne({
        where: { id: dealRoomId, is_deleted: false }
    });
};

// ─── Requester include config ─────────────────────────────────────────────────
// Used on every GET query that returns a meeting object.

const requesterInclude = {
    model: User,
    as: 'requester',
    attributes: ['first_name', 'last_name']
};

// ─── Helper — flatten nested requester into top-level fields ──────────────────
// Converts Sequelize instance → plain object and promotes requester name fields
// so the API response contains flat fields instead of a nested object:
//   requester_user_first_name: "John"
//   requester_user_last_name:  "Doe"

const flattenRequester = (meetingInstance) => {
    const plain = meetingInstance.toJSON();
    if (plain.requester) {
        plain.requester_user_first_name = plain.requester.first_name;
        plain.requester_user_last_name  = plain.requester.last_name;
        delete plain.requester;
    }
    return plain;
};

// ─── Meetings ─────────────────────────────────────────────────────────────────

const createMeeting = async (meetingData, { transaction } = {}) => {
    return await Meeting.create(meetingData, { transaction });
};

const getMeetingById = async (meetingId) => {
    const meeting = await Meeting.findOne({
        where: { id: meetingId, is_deleted: false },
        include: [requesterInclude]
    });
    return meeting ? flattenRequester(meeting) : null;
};

/**
 * Returns ALL meetings (past + upcoming) for a deal room, sorted chronologically.
 * Each meeting has requester_user_first_name and requester_user_last_name as flat fields.
 */
const getMeetingsByDealRoom = async (dealRoomId) => {
    const meetings = await Meeting.findAll({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false
        },
        include: [requesterInclude],
        order: [['scheduled_at', 'ASC']]
    });
    return meetings.map(flattenRequester);
};

/**
 * Returns the single nearest upcoming meeting for a deal room.
 * "Upcoming" means scheduled_at is strictly in the future.
 * Returns null if no upcoming meetings exist.
 */
const getUpcomingMeetingByDealRoom = async (dealRoomId) => {
    const now = new Date();
    const meeting = await Meeting.findOne({
        where: {
            deal_room_id: dealRoomId,
            is_deleted: false,
            scheduled_at: { [Op.gt]: now }
        },
        include: [requesterInclude],
        order: [['scheduled_at', 'ASC']]  // nearest first → LIMIT 1 via findOne
    });
    return meeting ? flattenRequester(meeting) : null;
};

const updateMeeting = async (updateData, meetingId, { transaction } = {}) => {
    const [updatedCount, updatedRows] = await Meeting.update(
        {
            ...updateData,
            updated_at: new Date()
        },
        {
            where: { id: meetingId, is_deleted: false },
            returning: true,   // PostgreSQL: returns the updated row
            transaction
        }
    );

    if (updatedCount === 0) {
        throw new Error(`Meeting not found with id ${meetingId}`);
    }

    return updatedRows[0];
};

module.exports = {
    getDealRoomById,
    createMeeting,
    getMeetingById,
    getMeetingsByDealRoom,
    getUpcomingMeetingByDealRoom,
    updateMeeting
};