'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserLimitConfig = sequelize.define('UserLimitConfig', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        allowed_connections: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        allowed_free_trial_days: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        allowed_premium_days: {
            type: DataTypes.INTEGER,
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

        tableName: 'user_limit_config',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'

    });

    UserLimitConfig.associate = (models) => {

        UserLimitConfig.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

    };

    return UserLimitConfig;
};