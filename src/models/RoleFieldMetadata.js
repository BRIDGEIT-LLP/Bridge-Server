'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const RoleFieldMetadata = sequelize.define('RoleFieldMetadata', {

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

        lookup: {
            type: DataTypes.STRING,
            allowNull: false
        },

        field_name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        source_table: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        display_name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },

        datatype: {
            type: DataTypes.STRING(150),
            allowNull: true
        },

        unit: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        display_format: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        file_extensions: {
            type: DataTypes.STRING(200),
            allowNull: true
        },

        is_required: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
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

        placeholder: {
            type: DataTypes.STRING(300),
            allowNull: true
        },

        help_text: {
            type: DataTypes.STRING(500),
            allowNull: true
        },

        is_encrypted: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
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
        tableName: 'role_field_metadata',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { unique: true, fields: ['role_id', 'lookup', 'source_table'] }
        ]
    });

    RoleFieldMetadata.associate = (models) => {
        RoleFieldMetadata.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'role_id',
            as: 'role'
        });
    };

    return RoleFieldMetadata;
};
