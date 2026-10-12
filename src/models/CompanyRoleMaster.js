'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const CompanyRoleMaster = sequelize.define('CompanyRoleMaster', {
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
        tableName: 'company_role_master',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    CompanyRoleMaster.associate = (models) => {
        CompanyRoleMaster.belongsTo(models.Admin, {
            foreignKey: 'created_by',
            as: 'createdBy'
        });

        CompanyRoleMaster.hasMany(models.CompanyUserRole, {
            foreignKey: 'role_id',
            as: 'companyUserRoles'
        });

        CompanyRoleMaster.hasMany(models.SubRoleMaster, {
            foreignKey: 'role_id',
            as: 'subRoles'
        });
    };

    return CompanyRoleMaster;
};