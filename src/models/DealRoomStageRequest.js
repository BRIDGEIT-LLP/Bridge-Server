'use strict';

const { DataTypes } = require('sequelize');

const { DEAL_ROOM_STAGE_REQUEST_STATUS } = require('../utils/constant');

module.exports = (sequelize) => {

    const DealRoomStageRequest = sequelize.define('DealRoomStageRequest', {

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

        requested_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        requested_by_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        current_stage: {
            type: DataTypes.STRING(50),
            allowNull: false
        },

        requested_stage: {
            type: DataTypes.STRING(50),
            allowNull: false
        },

        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: DEAL_ROOM_STAGE_REQUEST_STATUS.PENDING
        },

        responded_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        responded_at: {
            type: DataTypes.DATE,
            allowNull: true
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
        tableName: 'deal_room_stage_request',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['deal_room_id', 'status']
            }
        ]
    });

    DealRoomStageRequest.associate = (models) => {

        DealRoomStageRequest.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomStageRequest.belongsTo(models.User, {
            foreignKey: 'requested_by_user_id',
            as: 'requestedBy'
        });

        DealRoomStageRequest.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'requested_by_role_id',
            as: 'requestedByRole'
        });

        DealRoomStageRequest.belongsTo(models.User, {
            foreignKey: 'responded_by_user_id',
            as: 'respondedBy'
        });

        DealRoomStageRequest.hasMany(models.DealRoomStageRequestLog, {
            foreignKey: 'deal_room_stage_request_id',
            as: 'logs'
        });

    };

    return DealRoomStageRequest;
};