'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserConnectionStatusLog = sequelize.define('UserConnectionStatusLog', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        connection_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_connection',
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
        tableName: 'user_connection_status_log',
        timestamps: false,
        initialAutoIncrement: 1
    });

    UserConnectionStatusLog.associate = (models) => {

        UserConnectionStatusLog.belongsTo(models.UserConnection, {
            foreignKey: 'connection_id',
            as: 'connection'
        });

        UserConnectionStatusLog.belongsTo(models.User, {
            foreignKey: 'changed_by',
            as: 'changedBy'
        });

    };

    return UserConnectionStatusLog;
};