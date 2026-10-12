'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const RolePermissionMap = sequelize.define('RolePermissionMap', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },
        user_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        permission_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'permission_master',
                key: 'id'
            }
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
        tableName: 'role_permission_map',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                name: 'role_permission_map_user_type_permission_id_active',
                unique: true,
                fields: ['user_type', 'permission_id'],
                where: { is_deleted: false }
            }
        ]
    });

    RolePermissionMap.associate = (models) => {
        RolePermissionMap.belongsTo(models.PermissionMaster, {
            foreignKey: 'permission_id',
            as: 'permission'
        });

        RolePermissionMap.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdBy'
        });
    };

    return RolePermissionMap;
};
