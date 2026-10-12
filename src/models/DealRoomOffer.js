'use strict';

/**
 * One version of a Structured Funding Offer (Investor <-> Startup). Countering creates
 * a NEW row linked via parent_offer_id, all sharing the same root_offer_id, so the full
 * negotiation thread is one flat query. Status walks Draft -> Pending -> Accepted /
 * Rejected / Countered.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const DealRoomOffer = sequelize.define('DealRoomOffer', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        deal_room_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'deal_room', key: 'id' }
        },

        offered_by_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'user', key: 'id' }
        },
        offered_by_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'company_role_master', key: 'id' }
        },
        offered_by_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'company', key: 'id' }
        },

        recipient_user_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'user', key: 'id' }
        },
        recipient_role_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: { model: 'company_role_master', key: 'id' }
        },
        recipient_company_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: 'company', key: 'id' }
        },

        parent_offer_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'deal_room_offer', key: 'id' }
        },
        root_offer_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
            references: { model: 'deal_room_offer', key: 'id' }
        },
        is_counter_offer: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false
        },
        version: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'Draft'
        },

        currency: {
            type: DataTypes.STRING(10),
            allowNull: false
        },
        investment_amount: {
            type: DataTypes.DECIMAL(18, 2),
            allowNull: false
        },
        equity_percentage: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false
        },
        valuation_type: {
            type: DataTypes.STRING(20),
            allowNull: false
        },
        valid_until: {
            type: DataTypes.DATE,
            allowNull: false
        },
        terms_conditions: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        supporting_notes: {
            type: DataTypes.STRING(500),
            allowNull: true
        },

        sent_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        responded_at: {
            type: DataTypes.DATE,
            allowNull: true
        },
        responded_by_user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: { model: 'user', key: 'id' }
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
        tableName: 'deal_room_offer',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['deal_room_id', 'status'] },
            { fields: ['deal_room_id', 'created_at'] }
        ]
    });

    DealRoomOffer.associate = (models) => {

        DealRoomOffer.belongsTo(models.DealRoom, {
            foreignKey: 'deal_room_id',
            as: 'dealRoom'
        });

        DealRoomOffer.belongsTo(models.User, {
            foreignKey: 'offered_by_user_id',
            as: 'offeredBy'
        });

        DealRoomOffer.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'offered_by_role_id',
            as: 'offeredByRole'
        });

        DealRoomOffer.belongsTo(models.Company, {
            foreignKey: 'offered_by_company_id',
            as: 'offeredByCompany'
        });

        DealRoomOffer.belongsTo(models.User, {
            foreignKey: 'recipient_user_id',
            as: 'recipient'
        });

        DealRoomOffer.belongsTo(models.CompanyRoleMaster, {
            foreignKey: 'recipient_role_id',
            as: 'recipientRole'
        });

        DealRoomOffer.belongsTo(models.Company, {
            foreignKey: 'recipient_company_id',
            as: 'recipientCompany'
        });

        DealRoomOffer.belongsTo(models.User, {
            foreignKey: 'responded_by_user_id',
            as: 'respondedBy'
        });

        DealRoomOffer.belongsTo(models.DealRoomOffer, {
            foreignKey: 'parent_offer_id',
            as: 'parentOffer'
        });

        DealRoomOffer.hasMany(models.DealRoomOffer, {
            foreignKey: 'parent_offer_id',
            as: 'counterOffers'
        });

    };

    return DealRoomOffer;
};