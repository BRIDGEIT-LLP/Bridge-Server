'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const UserSubscription = sequelize.define('UserSubscription', {

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
            allowNull: false,
            references: {
                model: 'company',
                key: 'id'
            }
        },

        plan_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'subscription_plan',
                key: 'id'
            }
        },

        start_date: {
            type: DataTypes.DATE,
            allowNull: false
        },

        end_date: {
            type: DataTypes.DATE,
            allowNull: false
        },

        // 'pending' kept for compatibility with findActivePrememiumSubscription
        // in the connection service. Our new flow sets status directly to 'active'.
        status: {
            type: DataTypes.ENUM('pending', 'active', 'expired', 'cancelled'),
            allowNull: false,
            defaultValue: 'active'
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
        tableName: 'user_subscription',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    UserSubscription.associate = (models) => {

        UserSubscription.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        UserSubscription.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as: 'company'
        });

        UserSubscription.belongsTo(models.SubscriptionPlan, {
            foreignKey: 'plan_id',
            as: 'plan'
        });

        // Note: SubscriptionPaymentTransaction association will be added here
        // when payment gateway is integrated.

    };

    return UserSubscription;
};