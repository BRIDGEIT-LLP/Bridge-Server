'use strict';

const matchingEventRepository = require('../repositories/matchingEventRepository');
const HttpResponse = require('../utils/HttpResponse');
const { errorLogger } = require('../configs/logger');

const VALID_ACTIONS = [
    'shown',
    'skipped',
    'irrelevant_flag',
    'connection_sent',
    'deal_room_opened',
];

/**
 * POST /api/v1/matching/events
 * Log a single matching lifecycle event — called fire-and-forget from the
 * frontend explore page whenever a match is shown or the user takes an action.
 *
 * Body: {
 *   matchProfileId:    string (UUID)  — required
 *   action:            string         — required; one of VALID_ACTIONS
 *   algorithmType?:    string         — 'rule_based' | 'ml_model'
 *   compatibilityScore?: number       — 0–100
 *   matchSector?:      string         — primary sector of the matched profile
 * }
 */
const logMatchEvent = async (req, res, next) => {
    try {
        const userId = req.userId;
        const { matchProfileId, action, algorithmType, compatibilityScore, matchSector } = req.body;

        if (!matchProfileId) {
            return HttpResponse.error(res, {
                message: 'matchProfileId is required.',
                statusCode: 400,
            });
        }

        if (!action || !VALID_ACTIONS.includes(action)) {
            return HttpResponse.error(res, {
                message: `action must be one of: ${VALID_ACTIONS.join(', ')}`,
                statusCode: 400,
            });
        }

        await matchingEventRepository.logMatchingEvent({
            userId,
            matchProfileId,
            algorithmType,
            compatibilityScore: compatibilityScore != null ? Number(compatibilityScore) : null,
            matchSector: matchSector || null,
            action,
        });

        return HttpResponse.success(res, { message: 'Event logged.', data: {}, statusCode: 200 });

    } catch (error) {
        errorLogger.error(error);
        // 200 with empty body so the frontend fire-and-forget never blocks UX on failure
        return HttpResponse.success(res, { message: 'Event skipped.', data: {}, statusCode: 200 });
    }
};

module.exports = { logMatchEvent };