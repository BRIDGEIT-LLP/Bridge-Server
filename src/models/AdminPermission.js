'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AdminPermission = sequelize.define('AdminPermission', {
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
        permission_key: {
            type: DataTypes.STRING,
            allowNull: false
        },
        is_allowed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        created_by: {
            type: DataTypes.UUID,
            allowNull: true
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true
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
        tableName: 'admin_permission',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    AdminPermission.associate = (models) => {
        AdminPermission.belongsTo(models.Admin, {
            foreignKey: 'admin_id',
            as: 'admin'
        });
    };

    return AdminPermission;
};
