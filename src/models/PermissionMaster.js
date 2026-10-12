'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PermissionMaster = sequelize.define('PermissionMaster', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },
        permission_key: {
            type: DataTypes.STRING,
            allowNull: false
        },
        description: {
            type: DataTypes.STRING,
            allowNull: true
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
        tableName: 'permission_master',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    PermissionMaster.associate = (models) => {
        PermissionMaster.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdBy'
        });

        PermissionMaster.hasMany(models.RolePermissionMap, {
            foreignKey: 'permission_id',
            as: 'roleGrants'
        });
    };

    return PermissionMaster;
};
