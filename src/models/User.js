'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const User = sequelize.define('User', {

        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: DataTypes.UUIDV4,
            allowNull: false
        },
        // basic info
        first_name: {
            type: DataTypes.STRING,
            allowNull: true
        },

        last_name: {
            type: DataTypes.STRING,
            allowNull: true
        },

        profile_photo: {
            type: DataTypes.STRING,
            allowNull: true
        },

        intro_video: {
            type: DataTypes.STRING,
            allowNull: true
        },

        organization_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        short_bio: {
            type: DataTypes.STRING(300),
            allowNull: true
        },

        country: {
            type: DataTypes.STRING,
            allowNull: true
        },

        continent: {
            type: DataTypes.STRING,
            allowNull: true
        },

        primary_sector: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true
        },

        linkedin_profile_url: {
            type: DataTypes.STRING,
            allowNull: true
        },

        company_website_url: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // Registered office / residential address as per government ID (investor + b2b).
        address: {
            type: DataTypes.STRING(500),
            allowNull: true
        },

        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        },

        is_user_suspended: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false
        }, // admin or super admin can change this field

        company_email: {
            type: DataTypes.STRING,
            allowNull: true,
            unique: true
        },

        country_code: {
            type: DataTypes.STRING,
            allowNull: true
        },

        mobile_number: {
            type: DataTypes.STRING,
            allowNull: true
        },

        password: {
            type: DataTypes.STRING,
            allowNull: true
        },

        // startup info
        startup_industry_sector: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        funding_stage:  { type: DataTypes.STRING, allowNull: true },
        funding_currency: {type: DataTypes.STRING, allowNull: true },
        funding_ask_amt_min: { type: DataTypes.FLOAT, allowNull: true},
        funding_ask_amt_max: { type: DataTypes.FLOAT, allowNull: true},
        use_of_funds: { type: DataTypes.STRING, allowNull: true },
        team_size_min: { type: DataTypes.INTEGER, allowNull: true },
        team_size_max: { type: DataTypes.INTEGER, allowNull: true },
        incorporation_certificate: { type: DataTypes.STRING, allowNull: true },
        pitch_deck_certificate: { type: DataTypes.STRING, allowNull: true },
        business_description: { type: DataTypes.STRING, allowNull: true },
        startup_intent: { type: DataTypes.STRING, allowNull: true },
        // Repeatable [{ name, url }] rows from the "Founders & LinkedIn" widget.
        founders: { type: DataTypes.JSONB, allowNull: true },

        // Investor info
        ticket_size_amt_min: { type: DataTypes.FLOAT, allowNull: true },
        ticket_size_amt_max: { type: DataTypes.FLOAT, allowNull: true },
        ticket_currency: { type: DataTypes.STRING, allowNull: true },
        investment_thesis: { type: DataTypes.STRING(1000), allowNull: true },
        prefrerred_investment_stage: { type:DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        stage_focus: { type: DataTypes.STRING, allowNull: true },
        investor_sector_preference: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        geographic_investment_preference: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        // Continent half of the same widget; countries live in the column above.
        geographic_investment_preference_continent: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        investor_type: { type: DataTypes.STRING, allowNull: true },
        investor_portfolio_overview: { type: DataTypes.STRING, allowNull: true },
        number_of_investments_to_date: { type: DataTypes.INTEGER, allowNull: true },
        investor_intent: { type: DataTypes.STRING, allowNull: true },

        // B2B info
        b2b_sector: { type: DataTypes.STRING, allowNull: true },
        b2b_sub_sector: { type: DataTypes.STRING, allowNull: true },
        business_type: { type: DataTypes.STRING, allowNull: true },
        // "Geographies" widget — countries + continents, same shape as the investor pair.
        b2b_geography_country: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        b2b_geography_continent: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        revenue_band: { type: DataTypes.STRING, allowNull: true },
        min_order_quantity: { type: DataTypes.INTEGER, allowNull: true },
        export_rediness: { type: DataTypes.STRING, allowNull: true },
        industry_vertical: { type: DataTypes.STRING, allowNull: true },
        years_in_operation: { type: DataTypes.FLOAT, allowNull: true },
        operational_capacity_description: { type: DataTypes.STRING, allowNull: true },
        products_ervice_Offered: { type: DataTypes.STRING, allowNull: true },
        business_requirements: { type: DataTypes.STRING, allowNull: true },
        b2b_intent: { type: DataTypes.STRING, allowNull: true },

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

        tableName: 'user',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    User.associate = (models) => {

        User.hasMany(models.CompanyUserRole, {
            foreignKey: 'user_id',
            as: 'companyUserRoles'
        });

    };

    return User;
};