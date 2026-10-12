'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const SubscriptionPaymentTransaction = sequelize.define('SubscriptionPaymentTransaction', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        user_subscription_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_subscription',
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

        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },

        currency: {
            type: DataTypes.STRING(10),
            allowNull: false
        },

        billing_cycle: {
            type: DataTypes.ENUM('monthly', 'yearly'),
            allowNull: false
        },

        payment_gateway: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        gateway_order_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        gateway_payment_id: {
            type: DataTypes.STRING(255),
            allowNull: true
        },

        gateway_signature: {
            type: DataTypes.STRING(500),
            allowNull: true
        },

        status: {
            type: DataTypes.ENUM('pending', 'success', 'failed', 'refunded'),
            allowNull: false,
            defaultValue: 'pending'
        },

        payment_method: {
            type: DataTypes.STRING(50),
            allowNull: true
        },

        failure_reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        paid_at: {
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
        tableName: 'subscription_payment_transaction',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    SubscriptionPaymentTransaction.associate = (models) => {

        SubscriptionPaymentTransaction.belongsTo(models.UserSubscription, {
            foreignKey: 'user_subscription_id',
            as: 'subscription'
        });

        SubscriptionPaymentTransaction.belongsTo(models.User, {
            foreignKey: 'user_id',
            as: 'user'
        });

        SubscriptionPaymentTransaction.belongsTo(models.Company, {
            foreignKey: 'company_id',
            as: 'company'
        });

        SubscriptionPaymentTransaction.belongsTo(models.SubscriptionPlan, {
            foreignKey: 'plan_id',
            as: 'plan'
        });

    };

    return SubscriptionPaymentTransaction;
};