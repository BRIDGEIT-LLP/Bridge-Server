'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const BlockedEmail = sequelize.define('BlockedEmail', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        // Stored exactly as on the company record; no normalisation.
        email: {
            type: DataTypes.STRING,
            allowNull: false
        },

        reason: {
            type: DataTypes.STRING,
            allowNull: false
        },

        // Nullable so the block outlives a hard delete of the company/user.
        company_id: {
            type: DataTypes.UUID,
            allowNull: true
        },

        user_id: {
            type: DataTypes.UUID,
            allowNull: true
        },

        rejection_count: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        // Limit in force when the block was applied; the limit is configurable
        // and can change later.
        rejection_limit: {
            type: DataTypes.INTEGER,
            allowNull: true
        },

        blocked_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },

        blocked_by: {
            type: DataTypes.UUID,
            allowNull: true
        },

        // Reserved for the unblock feature (an unblock = soft-delete + these).
        unblocked_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        unblocked_by: {
            type: DataTypes.UUID,
            allowNull: true
        },
        unblock_reason: {
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
        tableName: 'blocked_email',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                // One active block per email. Partial on is_deleted so an unblocked
                // (soft-deleted) email can be blocked again later without a conflict.
                name: 'blocked_email_active_email_unique',
                unique: true,
                fields: ['email'],
                where: { is_deleted: false }
            }
        ]
    });

    return BlockedEmail;
};
