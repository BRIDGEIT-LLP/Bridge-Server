'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserProfileFieldMaster = sequelize.define('UserProfileFieldMaster', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        source_table: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        field_name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        // Request-payload key for this field when it differs from field_name
        // (e.g. 'pan_card' -> 'document_number'). Falls back to field_name when null.
        lookup: {
            type: DataTypes.STRING,
            allowNull: true
        },

        display_name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        is_editable: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        is_required: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },

        type: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'string'
        },

        datatype: {
            type: DataTypes.STRING(150),
            allowNull: true
        },

        unit: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        min_length: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        max_length: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        min_value: {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true
        },

        max_value: {
            type: DataTypes.DECIMAL(15, 4),
            allowNull: true
        },

        regex_pattern: {
            type: DataTypes.STRING(500),
            allowNull: true
        },

        allowed_values: {
            type: DataTypes.JSON,
            allowNull: true
        },

        display_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0
        },

        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
        },

        is_registration_field: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },

        is_kyc_field: {
            type: DataTypes.BOOLEAN,
            allowNull: true
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
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
            allowNull: false,
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
        tableName: 'user_profile_field_master',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['role_id', 'source_table', 'field_name'] }
        ]
    });

    UserProfileFieldMaster.associate = (models) => {
        UserProfileFieldMaster.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'role_id',
            as: 'role'
        });
    };

    return UserProfileFieldMaster;
};
