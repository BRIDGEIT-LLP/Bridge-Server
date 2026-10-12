'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomMedia = sequelize.define('DealRoomMedia', {

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

        caption: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        media_type: {
            type: DataTypes.STRING(20),
            allowNull: false
        },

        attachment_s3_key: {
            type: DataTypes.STRING,
            allowNull: false
        },

        attachment_file_name: {
            type: DataTypes.STRING,
            allowNull: false
        },

        attachment_mime_type: {
            type: DataTypes.STRING,
            allowNull: false
        },

        attachment_file_size: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        download_allowed: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        view_only: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true
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
        tableName: 'deal_room_media',
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
        ],
        hooks: {
            beforeCreate: (record) => {
                record.updated_at = null;
            }
        }
    });

    DealRoomMedia.associate = (models) => {

        DealRoomMedia.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomMedia.belongsTo(models.User, {
            foreignKey: 'sender_user_id',
            as: 'sender'
        });

        DealRoomMedia.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'sender_role_id',
            as: 'senderRole'
        });

        DealRoomMedia.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

        DealRoomMedia.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'recipient_role_id',
            as: 'recipientRole'
        });

    };

    return DealRoomMedia;
};