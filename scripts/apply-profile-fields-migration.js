/**
 * Applies ONLY migrations/20260902000000_addMissingProfileFields.js, then the matching
 * incremental field-master seed, then verifies.
 *
 * Why not `npm run migrate:run`: this database's "SequelizeMeta" records two migration
 * filenames that no longer exist in migrations/ (20260820065917_noname.js,
 * 20260821092215_creation.js). Every file now in the folder therefore looks pending, so
 * sequelize-cli replays the whole chain from the initial createTable and fails on
 * already-existing relations. That drift predates this change and is left alone here;
 * this script adds the eight new `user` columns and records just this migration.
 *
 * Idempotent: the addColumn steps are skipped for columns that already exist, and the
 * seed's own NOT EXISTS guard skips rows already present. Safe to re-run.
 */
process.env.APP_ENV = process.env.APP_ENV || 'local';
require('dotenv').config({ path: process.env.APP_ENV === 'uat' ? '.env.uat' : '.env' });

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');

const MIGRATION = '20260902000000_addMissingProfileFields.js';
const SEED = 'src/seed_data/2026-09-02_add_missing_profile_fields.sql';

(async () => {
    const qi = sequelize.getQueryInterface();

    // ── which of the migration's columns are already there ──
    const [existing] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'user'`
    );
    const present = new Set(existing.map((c) => c.column_name));

    // The migration module exposes up(queryInterface, sequelize), which would fail on
    // any column that already exists — so add the missing ones one at a time, with the
    // same definitions the migration declares. Keep the two in sync.
    const { DataTypes } = require('sequelize');
    const COLUMNS = {
        address: { type: DataTypes.STRING(500), allowNull: true },
        investment_thesis: { type: DataTypes.STRING(1000), allowNull: true },
        ticket_currency: { type: DataTypes.STRING, allowNull: true },
        geographic_investment_preference_continent: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true
        },
        business_type: { type: DataTypes.STRING, allowNull: true },
        b2b_geography_country: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        b2b_geography_continent: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: true },
        founders: { type: DataTypes.JSONB, allowNull: true }
    };

    const transaction = await sequelize.transaction();
    try {
        for (const [name, def] of Object.entries(COLUMNS)) {
            if (present.has(name)) {
                console.info(`skip   addColumn user.${name} (already exists)`);
                continue;
            }
            await qi.addColumn('user', name, def, { transaction });
            console.info(`add    user.${name}`);
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

        // ── field-master rows, so GET /users/profile actually returns the columns ──
        const seedSql = fs.readFileSync(path.join(__dirname, '..', SEED), 'utf8');
        await sequelize.query(seedSql, { transaction });
        console.info('seed   user_profile_field_master rows applied');

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        console.error('FAILED (rolled back):', err.message);
        process.exitCode = 1;
        await sequelize.close();
        return;
    }

    // ── verify ──
    const [cols] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = 'user'`
    );
    const now = new Set(cols.map((c) => c.column_name));
    const missing = Object.keys(COLUMNS).filter((c) => !now.has(c));
    console.info('\ncolumns added/verified:', Object.keys(COLUMNS).length - missing.length, '/', Object.keys(COLUMNS).length);
    if (missing.length) console.error('still missing:', missing);

    const [rows] = await sequelize.query(`
        SELECT crm.role_code, count(*)::int AS n
        FROM user_profile_field_master m
        JOIN company_role_master crm ON crm.id = m.role_id
        WHERE m.is_deleted = false AND crm.role_code IN ('STARTUP','INVESTOR','B2B')
        GROUP BY crm.role_code ORDER BY crm.role_code
    `);
    console.info('\nprofile fields configured per role:');
    for (const r of rows) console.info(`  ${r.role_code.padEnd(9)} ${r.n}`);

    await sequelize.close();
    if (missing.length) process.exitCode = 1;
})();
