'use strict';

/**
 * Develop-branch schema delta vs UAT (Sep 2026).
 * Used by scripts/apply-uat-schema-sync.js and the matching migration file.
 */
const { DataTypes } = require('sequelize');

const COMPANY_COLUMNS = {
    failed_login_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    locked_until: {
        type: DataTypes.DATE,
        allowNull: true
    }
};

const INDEXES = [
    {
        table: 'user_connection',
        name: 'uc_unique_connection',
        createSql: `
            CREATE UNIQUE INDEX uc_unique_connection
            ON user_connection (
                requester_user_id,
                requester_role_id,
                recipient_user_id,
                recipient_role_id,
                status
            )
            WHERE is_deleted = false
        `,
        matches: (def) =>
            def.includes('status') && /WHERE.*is_deleted\s*=\s*false/i.test(def),
        duplicateSql: `
            SELECT requester_user_id, requester_role_id, recipient_user_id,
                   recipient_role_id, status, count(*)::int AS n
            FROM user_connection
            WHERE is_deleted = false
            GROUP BY 1, 2, 3, 4, 5
            HAVING count(*) > 1
        `
    },
    {
        table: 'kyc_info',
        name: 'kyc_info_user_company_role_doc_type_unique',
        createSql: `
            CREATE UNIQUE INDEX kyc_info_user_company_role_doc_type_unique
            ON kyc_info (user_id, company_id, role_id, document_type)
            WHERE is_deleted = false
        `,
        matches: (def) => /WHERE.*is_deleted\s*=\s*false/i.test(def),
        duplicateSql: `
            SELECT user_id, company_id, role_id, document_type, count(*)::int AS n
            FROM kyc_info
            WHERE is_deleted = false
            GROUP BY 1, 2, 3, 4
            HAVING count(*) > 1
        `
    },
    {
        table: 'deal_room_archive',
        name: 'deal_room_archive_deal_room_id_user_id_active',
        createSql: `
            CREATE UNIQUE INDEX deal_room_archive_deal_room_id_user_id_active
            ON deal_room_archive (deal_room_id, user_id)
            WHERE is_deleted = false
        `,
        matches: (def) => /WHERE.*is_deleted\s*=\s*false/i.test(def),
        duplicateSql: `
            SELECT deal_room_id, user_id, count(*)::int AS n
            FROM deal_room_archive
            WHERE is_deleted = false
            GROUP BY 1, 2
            HAVING count(*) > 1
        `
    },
    {
        table: 'role_permission_map',
        name: 'role_permission_map_user_type_permission_id_active',
        createSql: `
            CREATE UNIQUE INDEX role_permission_map_user_type_permission_id_active
            ON role_permission_map (user_type, permission_id)
            WHERE is_deleted = false
        `,
        matches: (def) => /WHERE.*is_deleted\s*=\s*false/i.test(def),
        duplicateSql: `
            SELECT user_type, permission_id, count(*)::int AS n
            FROM role_permission_map
            WHERE is_deleted = false
            GROUP BY 1, 2
            HAVING count(*) > 1
        `
    }
];

async function columnNames(sequelize, table) {
    const [rows] = await sequelize.query(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table`,
        { replacements: { table } }
    );
    return new Set(rows.map((r) => r.column_name));
}

async function indexDef(sequelize, table, name) {
    const [rows] = await sequelize.query(
        `
        SELECT pg_get_indexdef(i.oid) AS index_def
        FROM pg_class t
        JOIN pg_index ix ON t.oid = ix.indrelid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = :table AND i.relname = :name
        `,
        { replacements: { table, name } }
    );
    return rows[0] ? rows[0].index_def : null;
}

async function up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const qi = queryInterface;

    const present = await columnNames(sequelize, 'company');
    for (const [name, def] of Object.entries(COMPANY_COLUMNS)) {
        if (present.has(name)) {
            console.info(`skip   addColumn company.${name} (already exists)`);
            continue;
        }
        await qi.addColumn('company', name, def);
        console.info(`add    company.${name}`);
    }

    for (const ix of INDEXES) {
        const current = await indexDef(sequelize, ix.table, ix.name);
        if (current && ix.matches(current)) {
            console.info(`skip   index ${ix.name} (already matches)`);
            continue;
        }

        const [dupes] = await sequelize.query(ix.duplicateSql);
        if (dupes.length) {
            throw new Error(
                `Cannot rebuild ${ix.name}: ${dupes.length} live duplicate group(s). ` +
                `First group: ${JSON.stringify(dupes[0])}`
            );
        }

        await sequelize.query(`DROP INDEX IF EXISTS ${ix.name}`);
        await sequelize.query(ix.createSql);
        console.info(`rebuild index ${ix.name}`);
    }
}

async function down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const qi = queryInterface;

    await sequelize.query('DROP INDEX IF EXISTS uc_unique_connection');
    await sequelize.query(`
        CREATE UNIQUE INDEX uc_unique_connection
        ON user_connection (
            requester_user_id,
            requester_role_id,
            recipient_user_id,
            recipient_role_id
        )
    `);

    await sequelize.query('DROP INDEX IF EXISTS kyc_info_user_company_role_doc_type_unique');
    await sequelize.query(`
        CREATE UNIQUE INDEX kyc_info_user_company_role_doc_type_unique
        ON kyc_info (user_id, company_id, role_id, document_type)
    `);

    await sequelize.query('DROP INDEX IF EXISTS deal_room_archive_deal_room_id_user_id_active');
    await sequelize.query(`
        CREATE UNIQUE INDEX deal_room_archive_deal_room_id_user_id_active
        ON deal_room_archive (deal_room_id, user_id)
    `);

    await sequelize.query('DROP INDEX IF EXISTS role_permission_map_user_type_permission_id_active');
    await sequelize.query(`
        CREATE UNIQUE INDEX role_permission_map_user_type_permission_id_active
        ON role_permission_map (user_type, permission_id)
    `);

    const present = await columnNames(sequelize, 'company');
    if (present.has('locked_until')) {
        await qi.removeColumn('company', 'locked_until');
    }
    if (present.has('failed_login_attempts')) {
        await qi.removeColumn('company', 'failed_login_attempts');
    }
}

module.exports = {
    COMPANY_COLUMNS,
    INDEXES,
    up,
    down
};
