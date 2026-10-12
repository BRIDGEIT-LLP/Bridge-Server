'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserSuspensionHistory = sequelize.define('UserSuspensionHistory', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        company_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        is_suspended: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        suspension_reason: {
            type: DataTypes.STRING,
            allowNull: true
        },

        created_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'admin',
                key: 'id'
            }
        },

        is_updated_by_super_admin: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }

    }, {
        tableName: 'user_suspension_history',
        timestamps: false,
        initialAutoIncrement: 1
    });

    UserSuspensionHistory.associate = (models) => {

        UserSuspensionHistory.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        UserSuspensionHistory.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as: 'company'
        });

        UserSuspensionHistory.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdByAdmin'
        });

    };

    return UserSuspensionHistory;
};
