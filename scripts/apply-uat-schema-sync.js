/**
 * Applies migrations/20260916150000_sync_develop_schema_to_uat.js against the
 * current APP_ENV database (use APP_ENV=uat for Azure UAT Postgres).
 *
 * Why not `npm run migrate:run`: UAT "SequelizeMeta" only has
 * 20260820065917_noname.js and 20260821092215_creation.js. sequelize-cli would
 * treat every later file as pending and replay createTable against existing
 * relations. This script applies only the develop-vs-UAT delta, idempotently.
 *
 * Run:
 *   cross-env APP_ENV=uat node scripts/apply-uat-schema-sync.js
 *
 * Safe to re-run.
 */
process.env.APP_ENV = process.env.APP_ENV || 'local';
require('dotenv').config({ path: process.env.APP_ENV === 'uat' ? '.env.uat' : '.env' });

const { sequelize } = require('../src/models');
const migration = require('./sync-develop-schema');

const MIGRATIONS_TO_RECORD = [
    '20260916101339_user_connection_unique_include_status.js',
    '20260916141404_add_login_lockout_to_company.js',
    '20260916150000_sync_develop_schema_to_uat.js'
];

(async () => {
    console.info(`target  ${process.env.DB_HOST} / ${process.env.DB_NAME}  (APP_ENV=${process.env.APP_ENV})`);

    const qi = sequelize.getQueryInterface();
    const transaction = await sequelize.transaction();
    const originalQuery = qi.sequelize.query.bind(qi.sequelize);
    const originalAddColumn = qi.addColumn.bind(qi);

    // Keep migration helpers on the same transaction as SequelizeMeta inserts.
    qi.sequelize.query = (sql, options = {}) =>
        originalQuery(sql, { transaction, ...options });
    qi.addColumn = (table, name, def, options = {}) =>
        originalAddColumn(table, name, def, { transaction, ...options });

    try {
        await migration.up(qi, sequelize.Sequelize);

        await sequelize.query(
            'CREATE TABLE IF NOT EXISTS "SequelizeMeta" ("name" VARCHAR(255) NOT NULL PRIMARY KEY)',
            { transaction }
        );
        for (const name of MIGRATIONS_TO_RECORD) {
            await sequelize.query(
                'INSERT INTO "SequelizeMeta" ("name") VALUES (:name) ON CONFLICT DO NOTHING',
                { replacements: { name }, transaction }
            );
            console.info(`record SequelizeMeta ${name}`);
        }

        await transaction.commit();
    } catch (err) {
        await transaction.rollback();
        console.error('FAILED (rolled back):', err.message);
        process.exitCode = 1;
        await sequelize.close();
        return;
    } finally {
        qi.sequelize.query = originalQuery;
        qi.addColumn = originalAddColumn;
    }

    const [cols] = await sequelize.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'company'
          AND column_name IN ('failed_login_attempts', 'locked_until')
        ORDER BY column_name
    `);
    console.info('\ncompany lockout columns:', cols.map((c) => c.column_name).join(', ') || '(none)');

    const [indexes] = await sequelize.query(`
        SELECT i.relname AS index_name, pg_get_indexdef(i.oid) AS index_def
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public'
          AND i.relname IN (
            'uc_unique_connection',
            'kyc_info_user_company_role_doc_type_unique',
            'deal_room_archive_deal_room_id_user_id_active',
            'role_permission_map_user_type_permission_id_active'
          )
        ORDER BY i.relname
    `);
    console.info('\nunique indexes:');
    for (const ix of indexes) {
        console.info(`  ${ix.index_name}`);
        console.info(`    ${ix.index_def}`);
    }

    const missingCols = ['failed_login_attempts', 'locked_until']
        .filter((c) => !cols.some((row) => row.column_name === c));
    const missingWhere = indexes.filter((ix) => !/WHERE.*is_deleted\s*=\s*false/i.test(ix.index_def));
    const connectionOk = indexes.some(
        (ix) => ix.index_name === 'uc_unique_connection' && ix.index_def.includes('status')
    );

    if (missingCols.length || missingWhere.length || !connectionOk) {
        console.error('\nstill missing:', { missingCols, missingWhere: missingWhere.map((i) => i.index_name), connectionOk });
        process.exitCode = 1;
    } else {
        console.info('\nUAT schema matches develop models for this delta.');
    }

    await sequelize.close();
})();
