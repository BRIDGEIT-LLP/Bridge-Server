'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const SubscriptionPlan = sequelize.define('SubscriptionPlan', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        plan_name: {
            type: DataTypes.STRING(100),
            allowNull: false
        },

        // Short unique code for programmatic reference, e.g. 'MONTHLY', 'YEARLY'
        plan_code: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true
        },

        // Each element is one benefit shown as a separate row in the UI
        plan_benefits: {
            type: DataTypes.ARRAY(DataTypes.TEXT),
            allowNull: false,
            defaultValue: []
        },

        // 30 for Monthly, 365 for Yearly
        validity_days: {
            type: DataTypes.INTEGER,
            allowNull: false
        },

        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true
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
        tableName: 'subscription_plan',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    SubscriptionPlan.associate = (models) => {

        SubscriptionPlan.hasMany(models.UserSubscription, {
            foreignKey: 'plan_id',
            as: 'subscriptions'
        });

        // Note: SubscriptionPlanPriceHistory and SubscriptionPaymentTransaction
        // associations will be added here when payment gateway is integrated.

    };

    return SubscriptionPlan;
};