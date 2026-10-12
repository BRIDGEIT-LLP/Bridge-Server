'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const Faq = sequelize.define('Faq', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },

        question: {
            type: DataTypes.TEXT,
            allowNull: false
        },

        answer: {
            type: DataTypes.TEXT,
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
        }

    }, {
        tableName: 'faq',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });

    return Faq;
};