'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const SubscriptionPlanPriceHistory = sequelize.define('SubscriptionPlanPriceHistory', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        plan_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'subscription_plan',
                key: 'id'
            }
        },

        old_price_monthly: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },

        new_price_monthly: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },

        old_price_yearly: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },

        new_price_yearly: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: true
        },

        currency: {
            type: DataTypes.STRING(10),
            allowNull: false
        },

        changed_by: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'admin',
                key: 'id'
            }
        },

        effective_from: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        reason: {
            type: DataTypes.TEXT,
            allowNull: true
        },

        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at'
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at'
        }

    }, {
        tableName: 'subscription_plan_price_history',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    SubscriptionPlanPriceHistory.associate = (models) => {

        SubscriptionPlanPriceHistory.belongsTo(models.SubscriptionPlan, {
            foreignKey: 'plan_id',
            as: 'plan'
        });

        SubscriptionPlanPriceHistory.belongsTo(models.Admin, {
            foreignKey: 'changed_by',
            as: 'changed_by_admin'
        });

    };

    return SubscriptionPlanPriceHistory;
};
