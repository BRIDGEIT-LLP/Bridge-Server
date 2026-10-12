'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const CompanyUserRole = sequelize.define('CompanyUserRole', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },

        company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        is_default_role: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'Pending'
        },

        is_profile_completed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        rejection_reason: {
            type: DataTypes.STRING,
            allowNull: true
        },

        approved_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'admin',
                key: 'id'
            }
        },

        approved_at: {
            type: DataTypes.DATE,
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

        tableName: 'company_user_role',
        timestamps: false,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'

    });

    CompanyUserRole.associate = (models) => {

        CompanyUserRole.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as: 'company'
        });

        CompanyUserRole.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        CompanyUserRole.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'role_id',
            as: 'role'
        });

    };

    return CompanyUserRole;
};