'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class UserSession extends Model {
        static associate(models) {
            UserSession.belongsTo(models.User, {
                foreignKey: 'user_id',
                as: 'user'
            });
        }
    }

    UserSession.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                primaryKey: true,
                allowNull: false
            },
            user_id: {
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
            modelName: 'UserSession',
            tableName: 'user_session', // singular, matches user / company / kyc_info convention
            underscored: true,
            timestamps: true,
            createdAt: 'created_at',
            updatedAt: 'updated_at'
        }
    );

    return UserSession;
};
