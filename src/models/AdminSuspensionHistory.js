'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const AdminSuspensionHistory = sequelize.define('AdminSuspensionHistory', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        admin_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'admin',
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

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        }

    }, {
        tableName: 'admin_suspension_history',
        timestamps: false,
        initialAutoIncrement: 1
    });

    AdminSuspensionHistory.associate = (models) => {

        AdminSuspensionHistory.belongsTo(models.Admin, {
            foreignKey: 'admin_id',
            as: 'admin'
        });

        AdminSuspensionHistory.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdByAdmin'
        });

    };

    return AdminSuspensionHistory;
};
