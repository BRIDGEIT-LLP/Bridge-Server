'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AdminActivityLog = sequelize.define('AdminActivityLog', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            field: 'id'
        },
        admin_id: {
            type: DataTypes.UUID,
            allowNull: false
        },
        performed_by: {
            type: DataTypes.UUID,
            allowNull: false
        },
        action: {
            type: DataTypes.STRING,
            allowNull: false
        },
        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        metadata: {
            type: DataTypes.JSONB,
            allowNull: true
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        }
    }, {
        tableName: 'admin_activity_log',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false
    });

    AdminActivityLog.associate = (models) => {
        AdminActivityLog.belongsTo(models.Admin, {
            foreignKey: 'admin_id',
            as: 'targetAdmin'
        });
        AdminActivityLog.belongsTo(models.Admin, {
            foreignKey: 'performed_by',
            as: 'performedByAdmin'
        });
    };

    return AdminActivityLog;
};