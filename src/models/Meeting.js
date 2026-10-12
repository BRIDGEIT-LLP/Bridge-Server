'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const Meeting = sequelize.define('Meeting', {

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

        requester_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        recipient_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        title: {
            type: DataTypes.STRING(255),
            allowNull: false
        },

        agenda: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        duration: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        meeting_link: {
            type: DataTypes.STRING(500),
            allowNull: false
        },

        scheduled_at: {
            type: DataTypes.DATE,
            allowNull: false
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

        updated_by: {
            type: DataTypes.UUID,
            allowNull: true
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
        tableName: 'meeting',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Meeting.associate = (models) => {

        Meeting.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        Meeting.belongsTo(models.User, {
            foreignKey: 'requester_user_id',
            as: 'requester'
        });

        Meeting.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

    };

    return Meeting;
};