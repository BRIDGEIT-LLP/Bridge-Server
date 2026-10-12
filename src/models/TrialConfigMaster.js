'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {

    const TrialConfigMaster = sequelize.define('TrialConfigMaster', {

        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id'
        },

        lookup: {
            type: DataTypes.STRING,
            allowNull: false
        },
        value: {
            type: DataTypes.STRING,
            allowNull: false
        },
        default_value: {
            type: DataTypes.STRING,
            allowNull: false
        },
        data_type: {
            type: DataTypes.STRING,
            allowNull: false
        },
        unit: {
            type: DataTypes.STRING,
            allowNull: false
        },

        description: {
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
            allowNull: false,
            references: {
                model: 'admin',
                key: 'id'
            }
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'updated_at'
        },
        updated_by: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: 'admin',
                key: 'id'
            }
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
            allowNull: true,
            references: {
                model: 'admin',
                key: 'id'
            }
        }

    }, {
        tableName: 'trial_config_master',
        timestamps: true,
        initialAutoIncrement: 1,
        createdAt: 'created_at',
        updatedAt: 'updated_at'
    });
    return TrialConfigMaster;
};
