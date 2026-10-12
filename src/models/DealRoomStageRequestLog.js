'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomStageRequestLog = sequelize.define('DealRoomStageRequestLog', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        deal_room_stage_request_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'deal_room_stage_request',
                key: 'id'
            }
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false
        },

        changed_by: {
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
        }

    }, {
        tableName: 'deal_room_stage_request_log',
        timestamps: false,
        initialAutoIncrement: 1
    });

    DealRoomStageRequestLog.associate = (models) => {

        DealRoomStageRequestLog.belongsTo(models.DealRoomStageRequest, {
            foreignKey: 'deal_room_stage_request_id',
            as: 'stageRequest'
        });

        DealRoomStageRequestLog.belongsTo(models.User, {
            foreignKey: 'changed_by',
            as: 'changedBy'
        });

    };

    return DealRoomStageRequestLog;
};