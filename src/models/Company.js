'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const Company = sequelize.define('Company', {

        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false,
            field: 'id'
        },

        company_name: {
            type: DataTypes.STRING,
            allowNull: false
        },

        company_email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true
        },

        country_code: {
            type: DataTypes.STRING,
            allowNull: true
        },

        mobile_number: {
            type: DataTypes.STRING,
            allowNull: false
        },

        password: {
            type: DataTypes.STRING,
            allowNull: false
        },

        gst_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        gst_number_iv: {
            type: DataTypes.STRING,
            allowNull: true
        },
        gst_number_auth_tag: {
            type: DataTypes.STRING,
            allowNull: true
        },

        cin_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cin_number_iv: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cin_number_auth_tag: {
            type: DataTypes.STRING,
            allowNull: true
        },

        terms_accepted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        is_mobile_number_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        is_email_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        is_gst_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        is_cin_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        is_kyc_uploaded: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        is_kyc_verified: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },

        kyc_status: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: 'Pending'
        },

        kyc_rejection_reason: {
            type: DataTypes.STRING,
            allowNull: true
        },

        failed_login_attempts: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },

        locked_until: {
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
        tableName: 'company',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    Company.associate = (models) => {

        Company.hasMany(models.CompanyUserRole, {
            foreignKey: 'company_id',
            as: 'companyUserRoles'
        });

    };

    return Company;
};