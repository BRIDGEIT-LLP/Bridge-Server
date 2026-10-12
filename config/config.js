// required for migrations

const dotenv = require('dotenv');
const env = process.env.APP_ENV || 'local';
dotenv.config({
    path: env === 'uat' ? '.env.uat' : '.env'
});

const useSSL = process.env.APP_ENV !== 'local';

module.exports = {
    development: {
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        host: process.env.DB_HOST,
        dialect: process.env.DB_DILECT,
        port: process.env.DB_PORT,
        dialectOptions: useSSL
            ? {
                ssl: {
                    require: true,
                    rejectUnauthorized: false
                }
            }
            : {}
    }
};