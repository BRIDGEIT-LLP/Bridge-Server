'use strict';

/**
 * One version of a B2B deal room's collaboratively-edited term sheet. Unlike
 * DealRoomOffer there is no status state machine — either party can save an edit at
 * any time, and every save is a NEW row (never an update of the old one), so the full
 * edit history is just `WHERE deal_room_id = X ORDER BY version`.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomTermSheet = sequelize.define('DealRoomTermSheet', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        deal_room_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'deal_room',
                key: 'id'
            }
        },

        version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },

        moq_quantity: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
        },

        moq_unit: {
            type: DataTypes.STRING(50),
            allowNull: false
        },

        unit_price: {
            type: DataTypes.DECIMAL(12, 2),
            allowNull: false
        },

        currency: {
            type: DataTypes.STRING(10),
            allowNull: false
        },

        payment_terms: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        supply_logistics_terms: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        updated_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: true
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at'
        },
        is_deleted: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        deleted_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        deleted_by: {
            type: DataTypes.UUID,
            allowNull: true
        }

    }, {
        tableName: 'deal_room_term_sheet',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['deal_room_id', 'version']
            },
            {
                fields: ['deal_room_id', 'created_at']
            }
        ]
    });

    DealRoomTermSheet.associate = (models) => {

        DealRoomTermSheet.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomTermSheet.belongsTo(models.User, {
            foreignKey: 'updated_by_user_id',
            as: 'updatedBy'
        });

    };

    return DealRoomTermSheet;
};