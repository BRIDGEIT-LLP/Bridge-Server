'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserConnection = sequelize.define('UserConnection', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        requester_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        requester_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        requester_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        recipient_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'user',
                key: 'id'
            }
        },

        recipient_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'company_role_master',
                key: 'id'
            }
        },

        recipient_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        status: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'pending'
        },

        message: {
            type: DataTypes.STRING,
            allowNull: true
        },

        bussiness_intent: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true
        },

        expected_deal_size: {
            type: DataTypes.STRING,
            allowNull: true
        },

        product_service_details: {
            type: DataTypes.STRING,
            allowNull: true
        },

        reason: {
            type: DataTypes.STRING,
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
        tableName: 'user_connection',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                // Pair + status, scoped to live rows. Declined/Withdrawn/Expired therefore
                // do not collide with a new Pending request for the same role pair.
                unique: true,
                fields: ['requester_user_id', 'requester_role_id', 'recipient_user_id', 'recipient_role_id', 'status'],
                where: { is_deleted: false },
                name: 'uc_unique_connection'
            }
        ]
    });

    UserConnection.associate = (models) => {

        UserConnection.belongsTo(models.User, {
            foreignKey: 'requester_user_id',
            as: 'requester'
        });

        UserConnection.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

        UserConnection.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'requester_role_id',
            as: 'requesterRole'
        });

        UserConnection.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'recipient_role_id',
            as: 'recipientRole'
        });

        UserConnection.belongsTo(models.Company, {
            foreignKey: 'requester_company_id',
            as: 'requesterCompany'
        });

        UserConnection.belongsTo(models.Company, {
            foreignKey: 'recipient_company_id',
            as: 'recipientCompany'
        });

        UserConnection.hasMany(models.UserConnectionStatusLog, {
            foreignKey: 'connection_id',
            as: 'statusLogs'
        });

    };

    return UserConnection;
};