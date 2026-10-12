'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomMessage = sequelize.define('DealRoomMessage', {

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

        sender_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        sender_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
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

        message: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        read_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        stage: {
            type: DataTypes.STRING(50),
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
        tableName: 'deal_room_message',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['deal_room_id', 'created_at']
            },
            {
                fields: ['recipient_user_id', 'read_at']
            }
        ]
    });

    DealRoomMessage.associate = (models) => {

        DealRoomMessage.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomMessage.belongsTo(models.User, {
            foreignKey: 'sender_user_id',
            as: 'sender'
        });

        DealRoomMessage.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'sender_role_id',
            as: 'senderRole'
        });

        DealRoomMessage.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

        DealRoomMessage.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'recipient_role_id',
            as: 'recipientRole'
        });

    };

    return DealRoomMessage;
};