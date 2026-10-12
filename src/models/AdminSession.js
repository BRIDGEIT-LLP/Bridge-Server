'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class AdminSession extends Model {
        static associate(models) {
            AdminSession.belongsTo(models.Admin, {
                foreignKey: 'admin_id',
                as: 'admin'
            });
        }
    }

    AdminSession.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            admin_id: {
                type: DataTypes.UUID,
                allowNull: false
            },
            token_jti: {
                type: DataTypes.STRING,
                allowNull: false,
                unique: true
            },
            device_name: DataTypes.STRING,
            browser: DataTypes.STRING,
            os: DataTypes.STRING,
            ip_address: DataTypes.STRING,
            last_activity_at: DataTypes.DATE,
            expires_at: DataTypes.DATE,
            is_revoked: {
                type: DataTypes.BOOLEAN,
                allowNull: false,
                defaultValue: false
            }
        },
        {
            sequelize,
            modelName: 'AdminSession',
            tableName: 'admin_session',
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return AdminSession;
};
