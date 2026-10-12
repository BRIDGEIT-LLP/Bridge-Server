'use strict';

const { DataTypes } = require('sequelize');

const { DEAL_ROOM_STATUS, DEAL_ROOM_STAGES } = require('../utils/constant');

module.exports = (sequelize) => {

    const DealRoom = sequelize.define('DealRoom', {

        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },

        connection_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            references: {
                model: 'user_connection',
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

        requester_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        requester_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'company',
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

        recipient_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        recipient_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        title: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        status: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: DEAL_ROOM_STATUS.ACTIVE
        },
        stage: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: DEAL_ROOM_STAGES.INITIAL_CONNECTION
        },

        closed_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        closed_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        closed_by: {
            type: DataTypes.UUID,
            allowNull: true,
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
        tableName: 'deal_room',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    DealRoom.associate = (models) => {

        DealRoom.belongsTo(models.UserConnection, {
            foreignKey: 'connection_id',
            as: 'connection'
        });

        DealRoom.belongsTo(models.User, {
            foreignKey: 'requester_user_id',
            as: 'requester'
        });

        DealRoom.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'requester_role_id',
            as: 'requesterRole'
        });

        DealRoom.belongsTo(models.Company, {
            foreignKey: 'requester_company_id',
            as: 'requesterCompany'
        });

        DealRoom.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

        DealRoom.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'recipient_role_id',
            as: 'recipientRole'
        });

        DealRoom.belongsTo(models.Company, {
            foreignKey: 'recipient_company_id',
            as: 'recipientCompany'
        });

        DealRoom.hasMany(models.DealRoomMessage, {
            foreignKey: 'deal_room_id',
            as: 'messages'
        });

        DealRoom.hasMany(models.DealRoomMedia, {
            foreignKey: 'deal_room_id',
            as: 'media'
        });

        DealRoom.hasMany(models.DealRoomStageRequest, {
            foreignKey: 'deal_room_id',
            as: 'stageRequests'
        });

        DealRoom.hasMany(models.DealRoomArchive, {
            foreignKey: 'deal_room_id',
            as: 'archives'
        });

    };

    return DealRoom;
};