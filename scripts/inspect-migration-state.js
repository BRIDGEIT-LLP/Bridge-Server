/* Read-only: reports migration tracking vs. the columns actually on `user`. */
// src/models/index.js reads process.env directly; only src/app.js loads dotenv.
process.env.APP_ENV = process.env.APP_ENV || 'local';
require('dotenv').config({ path: process.env.APP_ENV === 'uat' ? '.env.uat' : '.env' });
const { sequelize } = require('../src/models');

const NEW_COLUMNS = [
    'address',
    'investment_thesis',
    'ticket_currency',
    'geographic_investment_preference_continent',
    'business_type',
    'b2b_geography_country',
    'b2b_geography_continent',
    'founders'
];

(async () => {
    try {
        const [meta] = await sequelize.query(
            'SELECT name FROM "SequelizeMeta" ORDER BY name'
        ).catch(() => [[]]);
        console.info('SequelizeMeta rows:', meta.length ? meta.map((m) => m.name) : '(none / table missing)');

        const [cols] = await sequelize.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = 'user' ORDER BY column_name`
        );
        const present = new Set(cols.map((c) => c.column_name));
        console.info('\n`user` table column count:', present.size);
        console.info('New columns present :', NEW_COLUMNS.filter((c) => present.has(c)));
        console.info('New columns MISSING :', NEW_COLUMNS.filter((c) => !present.has(c)));

        const [fm] = await sequelize.query(
            'SELECT count(*)::int AS n FROM user_profile_field_master WHERE is_deleted = false'
        );
        console.info('\nuser_profile_field_master active rows:', fm[0].n);
    } catch (err) {
        console.error('inspect failed:', err.message);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
