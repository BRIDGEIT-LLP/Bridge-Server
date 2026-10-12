'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const AdminRoleMaster = sequelize.define('AdminRoleMaster', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },
        role_name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        role_code: {
            type: DataTypes.STRING,
            allowNull: true
        },
        role_description: {
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
            allowNull: false
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
        tableName: 'admin_role_master',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    AdminRoleMaster.associate = (models) => {
        AdminRoleMaster.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdBy'
        });
    };

    return AdminRoleMaster;
};
