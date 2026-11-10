'use strict';
/**
 * One-off data fix: make every mobile_number unique across "user" and "company".
 * Randomly mutates digits of the existing number (country_code is untouched).
 * Usage: node scripts/randomize-mobile-numbers.js <envFile> <local|uat> [--apply]
 * Dry-run unless --apply is passed. Old values are written to a CSV backup.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const [envFile, target, flag] = process.argv.slice(2);
require('dotenv').config({ path: path.resolve(__dirname, '..', envFile), override: true });
const apply = flag === '--apply';
const ssl = target === 'uat' ? { rejectUnauthorized: false } : false;
const rnd = (n) => crypto.randomInt(n);

const mutate = (num) => {
    const d = num.split('');
    const positions = new Set();
    while (positions.size < Math.min(4, d.length - 1)) positions.add(1 + rnd(d.length - 1)); // keep first digit
    positions.forEach((p) => { d[p] = String(rnd(10)); });
    return d.join('');
};

(async () => {
    const c = new Client({ host: process.env.DB_HOST, port: process.env.DB_PORT, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD, ssl });
    await c.connect();
    console.log(`Target: ${target} ${process.env.DB_HOST}/${process.env.DB_NAME} apply=${apply}`);
    const pk = {};
    for (const t of ['user', 'company']) {
        const r = await c.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey) where i.indrelid='"${t}"'::regclass and i.indisprimary`);
        pk[t] = r.rows[0].attname;
    }
    const rows = [];
    for (const t of ['user', 'company']) {
        const r = await c.query(`select "${pk[t]}" as id, mobile_number from "${t}" where mobile_number is not null`);
        r.rows.forEach((x) => rows.push({ t, id: x.id, old: x.mobile_number }));
    }
    const used = new Set();
    rows.forEach((r) => {
        let n; let tries = 0;
        do { n = mutate(r.old); tries++; if (tries > 50) n = String(6 + rnd(4)) + String(rnd(1e9)).padStart(9, '0'); } while (used.has(n));
        used.add(n); r.new = n;
    });
    console.log(`rows: ${rows.length}, unique new numbers: ${used.size}`);
    if (!apply) { console.log(rows.slice(0, 5)); return c.end(); }
    const bak = path.join(process.env.BACKUP_DIR || __dirname, `mobile_backup_${target}.csv`);
    fs.writeFileSync(bak, 'table,id,old_mobile,new_mobile\n' + rows.map((r) => `${r.t},${r.id},${r.old},${r.new}`).join('\n'));
    console.log('backup:', bak);
    await c.query('begin');
    try {
        for (const r of rows) await c.query(`update "${r.t}" set mobile_number=$1 where "${pk[r.t]}"=$2`, [r.new, r.id]);
        const v = await c.query(`select count(*) n, count(distinct m) d from (select mobile_number m from "user" where mobile_number is not null union all select mobile_number from company where mobile_number is not null) x`);
        console.log('verify', v.rows[0]);
        if (v.rows[0].n !== v.rows[0].d) throw new Error('not unique');
        await c.query('commit');
        console.log('committed');
    } catch (e) { await c.query('rollback'); throw e; }
    await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
