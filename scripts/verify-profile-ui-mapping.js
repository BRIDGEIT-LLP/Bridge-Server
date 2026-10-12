/**
 * Read-only end-to-end check: every column the LIVE database will make
 * GET /api/v1/users/profile return, for every role, has a home in the My Profile UI
 * (listed in PROFILE_SECTIONS, or deliberately folded into a composite widget).
 *
 * This is the database-backed counterpart of check-profile-mapping.js at the repo root,
 * which reads the seed file instead. Run after any user_profile_field_master change.
 */
process.env.APP_ENV = process.env.APP_ENV || 'local';
require('dotenv').config({ path: process.env.APP_ENV === 'uat' ? '.env.uat' : '.env' });

const fs = require('fs');
const path = require('path');
const { sequelize } = require('../src/models');

const PAGE = path.join(
    __dirname, '..', '..', 'Bridge-Web', 'src', 'app', 'dashboard', 'profile', 'page.tsx'
);
// Rendered inside the phone / funding-ask widgets at their anchor column, so they are
// intentionally absent from PROFILE_SECTIONS.
const FOLDED = new Set(['country_code', 'funding_currency', 'funding_ask_amt_max']);

(async () => {
    const page = fs.readFileSync(PAGE, 'utf8');
    const sections = page.slice(
        page.indexOf('export const PROFILE_SECTIONS'),
        page.indexOf('const ADMIN_PROFILE_SECTIONS')
    );
    const placed = new Set(
        [...sections.matchAll(/"([a-z][A-Za-z_0-9]*)"/g)].map((m) => m[1])
    );

    const [rows] = await sequelize.query(`
        SELECT crm.role_code, m.field_name
        FROM user_profile_field_master m
        JOIN company_role_master crm ON crm.id = m.role_id
        WHERE m.is_deleted = false AND crm.role_code IN ('STARTUP','INVESTOR','B2B')
    `);

    const byRole = {};
    for (const r of rows) {
        // userService.getUserProfile filters this one out before responding.
        if (r.field_name === 'company_name') continue;
        (byRole[r.role_code] ||= new Set()).add(r.field_name);
    }

    let failed = false;
    for (const role of ['STARTUP', 'INVESTOR', 'B2B']) {
        const cols = byRole[role] || new Set();
        const missing = [...cols].filter((c) => !placed.has(c) && !FOLDED.has(c)).sort();
        if (missing.length) failed = true;
        console.info(
            `${role.padEnd(9)} API returns ${String(cols.size).padStart(2)} columns  ->  ` +
            `unplaced in UI: ${missing.length ? missing.join(', ') : 'NONE'}`
        );
    }

    const all = new Set(Object.values(byRole).flatMap((s) => [...s]));
    const unused = [...placed].filter((c) => !all.has(c) && !FOLDED.has(c)).sort();
    console.info('\nListed in PROFILE_SECTIONS but never returned by any role:', unused.join(', ') || 'none');
    console.info(failed
        ? '\nFAIL'
        : '\nPASS - every column the live DB returns has a UI home for every role');

    await sequelize.close();
    if (failed) process.exitCode = 1;
})();
