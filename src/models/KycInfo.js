'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const KycInfo = sequelize.define('KycInfo', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        company_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        role_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        document_type: {
            type: DataTypes.STRING,
            allowNull: false
        },

        document_number: {
            type: DataTypes.STRING,
            allowNull: true
        },
        document_number_iv: {
            type: DataTypes.STRING,
            allowNull: true
        },
        document_number_auth_tag: {
            type: DataTypes.STRING,
            allowNull: true
        },

        front_s3_key: {
            type: DataTypes.STRING,
            allowNull: true
        },
        front_file_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        front_file_size: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        front_mime_type: {
            type: DataTypes.STRING,
            allowNull: true
        },

        back_s3_key: {
            type: DataTypes.STRING,
            allowNull: true
        },
        back_file_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        back_file_size: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        back_mime_type: {
            type: DataTypes.STRING,
            allowNull: true
        },
        
        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'pending'
        },

        rejection_reason: {
            type: DataTypes.STRING,
            allowNull: true
        },

        verified_at: {
            type: DataTypes.DATE,
            allowNull: true
        },

        verified_by: {
            type: DataTypes.UUID,
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
        tableName: 'kyc_info',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                // One live row per document type per user/company/role. kycService.createKycInfo
                // upserts by reading then writing; two concurrent submissions (double-click, a
                // retried request) can both read "not found", so this constraint — not the read —
                // is what actually prevents duplicate rows. Partial on is_deleted so a soft-deleted
                // row never blocks a fresh upload.
                name: 'kyc_info_user_company_role_doc_type_unique',
                unique: true,
                fields: ['user_id', 'company_id', 'role_id', 'document_type'],
                where: { is_deleted: false }
            }
        ]
    });

    KycInfo.associate = (models) => {

        KycInfo.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        KycInfo.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as: 'company'
        });

        KycInfo.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'role_id',
            as: 'role'
        });

    };

    return KycInfo;
};