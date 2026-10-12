'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomArchive = sequelize.define('DealRoomArchive', {

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

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        archived_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
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
        tableName: 'deal_room_archive',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['deal_room_id', 'user_id'],
                where: { is_deleted: false },
                name: 'deal_room_archive_deal_room_id_user_id_active'
            }
        ]
    });

    DealRoomArchive.associate = (models) => {

        DealRoomArchive.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomArchive.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

    };

    return DealRoomArchive;
};