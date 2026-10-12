/**
 * Applies ONLY migrations/20260916141404_add_login_lockout_to_company.js, then verifies.
 *
 * Why not `npm run migrate:run`: this repo's migrations/ folder is gitignored, so a
 * freshly-pulled environment's SequelizeMeta can be missing/out of sync with the files
 * actually present locally (see scripts/apply-profile-fields-migration.js for the prior
 * occurrence of this). Rather than risk `sequelize-cli db:migrate` replaying the whole
 * chain from the initial createTable, this script adds just the two new `company`
 * columns and records this one migration.
 *
 * Idempotent: addColumn steps are skipped for columns that already exist. Safe to re-run.
 */
process.env.APP_ENV = process.env.APP_ENV || 'local';
require('dotenv').config({ path: process.env.APP_ENV === 'uat' ? '.env.uat' : '.env' });

const { sequelize } = require('../src/models');
const { DataTypes } = require('sequelize');

const MIGRATION = '20260916141404_add_login_lockout_to_company.js';

const COLUMNS = {
    failed_login_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    locked_until: { type: DataTypes.DATE, allowNull: true }
};

(async () => {
    const qi = sequelize.getQueryInterface();

    const [existing] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'company'`
    );
    const present = new Set(existing.map((c) => c.column_name));

    const transaction = await sequelize.transaction();
    try {
        for (const [name, def] of Object.entries(COLUMNS)) {
            if (present.has(name)) {
                console.info(`skip   addColumn company.${name} (already exists)`);
                continue;
            }
            await qi.addColumn('company', name, def, { transaction });
            console.info(`add    company.${name}`);
        }

        // Record this migration so a future `migrate:run` does not replay it.
        await sequelize.query(
            'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)',
            { transaction }
        );
        await sequelize.query(
            'INSERT INTO "SequelizeMeta" ("name") VALUES (:name) ON CONFLICT DO NOTHING',
            { replacements: { name: MIGRATION }, transaction }
        );

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        console.error('FAILED (rolled back):', err.message);
        process.exitCode = 1;
        await sequelize.close();
        return;
    }

    const [cols] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'company'`
    );
    const now = new Set(cols.map((c) => c.column_name));
    const missing = Object.keys(COLUMNS).filter((c) => !now.has(c));
    console.info('\ncolumns added/verified:', Object.keys(COLUMNS).length - missing.length, '/', Object.keys(COLUMNS).length);
    if (missing.length) console.error('still missing:', missing);

    await sequelize.close();
    if (missing.length) process.exitCode = 1;
})();
