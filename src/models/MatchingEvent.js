'use strict';

const { DataTypes } = require('sequelize');

/** Valid action types for matching_events.action */
const MATCHING_EVENT_ACTIONS = {
    SHOWN:            'shown',
    SKIPPED:          'skipped',
    IRRELEVANT_FLAG:  'irrelevant_flag',
    CONNECTION_SENT:  'connection_sent',
    DEAL_ROOM_OPENED: 'deal_room_opened'
};

/** Algorithm types — tracks cold-start vs. ML ratio (FRD 12.3) */
const ALGORITHM_TYPES = {
    RULE_BASED: 'rule_based',
    ML_MODEL:   'ml_model'
};

module.exports = (sequelize) => {

    const MatchingEvent = sequelize.define('MatchingEvent', {

        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'user', key: 'id' }
        },

        match_profile_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'user', key: 'id' }
        },

        algorithm_type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: ALGORITHM_TYPES.RULE_BASED
        },

        compatibility_score: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: true
        },

        match_sector: {
            type: DataTypes.STRING(100),
            allowNull: true
        },

        action: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: MATCHING_EVENT_ACTIONS.SHOWN
        },

        action_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },

        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at'
        },

        is_deleted:  { type: DataTypes.BOOLEAN,  allowNull: true, defaultValue: false },
        deleted_at:  { type: DataTypes.DATE,     allowNull: true },
        created_by:  { type: DataTypes.UUID,     allowNull: true },
        updated_by:  { type: DataTypes.UUID,     allowNull: true },
        deleted_by:  { type: DataTypes.UUID,     allowNull: true }

    }, {
        tableName:  'matching_events',
        timestamps: true,
        createdAt:  'created_at',
        updatedAt:  'updated_at',
        indexes: [
            { fields: ['user_id'], name: 'matching_events_user_id_idx' },
            { fields: ['action', 'created_at'], name: 'matching_events_action_created_at_idx' }
        ]
    });

    MatchingEvent.associate = (models) => {
        MatchingEvent.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });
        MatchingEvent.belongsTo(models.User, {
            foreignKey: 'match_profile_id',
            as: 'matchProfile'
        });
    };

    return MatchingEvent;
};

module.exports.MATCHING_EVENT_ACTIONS = MATCHING_EVENT_ACTIONS;
module.exports.ALGORITHM_TYPES        = ALGORITHM_TYPES;