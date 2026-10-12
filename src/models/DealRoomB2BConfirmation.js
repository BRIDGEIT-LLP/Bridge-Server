'use strict';

/**
 * A B2B term-sheet confirmation — one row per deal room, written the moment the room
 * moves Negotiation -> Due Diligence via the standard Request-Next-Stage / Accept flow.
 * It snapshots which term sheet version was final at that point (`confirmed_term_sheet_id`)
 * and records the two-party consent implicit in that flow: one participant requested the
 * transition, the other accepted it. No separate "confirm" button or window — the accept
 * IS the confirmation.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomB2BConfirmation = sequelize.define('DealRoomB2BConfirmation', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        deal_room_id: {
            type: DataTypes.UUID,
            allowNull: false,
            unique: true,
            references: {
                model: 'deal_room',
                key: 'id'
            }
        },

        confirmed_term_sheet_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'deal_room_term_sheet',
                key: 'id'
            }
        },

        requested_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        accepted_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        confirmed_at: {
            type: DataTypes.DATE,
            allowNull: false
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
        }

    }, {
        tableName: 'deal_room_b2b_confirmation',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    DealRoomB2BConfirmation.associate = (models) => {

        DealRoomB2BConfirmation.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomB2BConfirmation.belongsTo(models.DealRoomTermSheet, {
            foreignKey: 'confirmed_term_sheet_id',
            as: 'confirmedTermSheet'
        });

        DealRoomB2BConfirmation.belongsTo(models.User, {
            foreignKey: 'requested_by_user_id',
            as: 'requestedBy'
        });

        DealRoomB2BConfirmation.belongsTo(models.User, {
            foreignKey: 'accepted_by_user_id',
            as: 'acceptedBy'
        });

    };

    return DealRoomB2BConfirmation;
};