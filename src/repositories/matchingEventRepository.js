'use strict';

const { sequelize } = require('../models');

/**
 * Write one matching lifecycle event to the matching_events table.
 *
 * @param {object} params
 * @param {string} params.userId            UUID of the user who received the match
 * @param {string} params.matchProfileId    UUID of the profile that was recommended
 * @param {string} [params.algorithmType]   'rule_based' | 'ml_model'  (default: 'rule_based')
 * @param {number|null} [params.compatibilityScore]  0–100 score from matching engine
 * @param {string|null} [params.matchSector]         Primary sector of the matched profile
 * @param {string} [params.action]          'shown' | 'skipped' | 'irrelevant_flag' |
 *                                          'connection_sent' | 'deal_room_opened'
 */
const logMatchingEvent = async ({
    userId,
    matchProfileId,
    algorithmType    = 'rule_based',
    compatibilityScore = null,
    matchSector      = null,
    action           = 'shown',
}) => {
    await sequelize.query(
        `INSERT INTO matching_events
            (user_id, match_profile_id, algorithm_type, compatibility_score, match_sector, action, action_at, created_at)
         VALUES
            (:userId, :matchProfileId, :algorithmType, :compatibilityScore, :matchSector, :action, NOW(), NOW())`,
        {
            replacements: {
                userId,
                matchProfileId,
                algorithmType,
                compatibilityScore,
                matchSector,
                action,
            },
        }
    );
};

module.exports = { logMatchingEvent };