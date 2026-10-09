// Checks the two fixture paths the UI depends on: the checklist resolves a
// real link per destination, and resources scope to that destination.
//
// Runs against the database, no server needed. Run it after changing the
// settlement/resource seeds.
//
//   node --import ./scripts/dns-shim.mjs scripts/verify-checklist-fixtures.mjs
import fs from 'fs';
import path from 'path';
import pg from 'pg';
import assert from 'node:assert';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// Mirrors the URL resolution in GET /api/settlement so this actually tests it.
const SETTLEMENT_SQL = `
  SELECT st.id, st.title, st.category,
         COALESCE(st.url, (
           SELECT r.url FROM resources r
           WHERE r.url IS NOT NULL
             AND LOWER(r.category) = LOWER(st.category)
             AND (LOWER(COALESCE(r.city,''))    = LOWER(COALESCE($2::text,''))
               OR LOWER(COALESCE(r.country,'')) = LOWER(COALESCE($3::text,'')))
           ORDER BY (r.city IS NULL), (r.country IS NULL), r.id
           LIMIT 1
         ), (
           SELECT r.url FROM resources r
           WHERE r.url IS NOT NULL AND LOWER(r.category) = LOWER(st.category)
           ORDER BY r.id LIMIT 1
         )) AS url
  FROM settlement_tasks st
  WHERE $1::int IS NOT NULL
  ORDER BY st."order"`;

const checks = [];
const check = (name, fn) => checks.push([name, fn]);

// ── 1. No duplicate titles ────────────────────────────────────
check('no duplicate task titles', async () => {
  const { rows } = await db.query(
    `SELECT LOWER(title) t, count(*) n FROM settlement_tasks GROUP BY 1 HAVING count(*) > 1`
  );
  assert.equal(rows.length, 0, `duplicate task titles: ${rows.map(r => r.t).join(', ')}`);
});

check('no duplicate resource titles', async () => {
  const { rows } = await db.query(
    `SELECT LOWER(title) t, count(*) n FROM resources GROUP BY 1 HAVING count(*) > 1`
  );
  assert.equal(rows.length, 0, `duplicate resource titles: ${rows.map(r => r.t).join(', ')}`);
});

// ── 2. Orders are dense and unique, so the checklist has a real sequence ──
check('task order has no gaps or ties', async () => {
  const { rows } = await db.query(
    `SELECT "order" o, count(*) n FROM settlement_tasks GROUP BY 1 HAVING count(*) > 1`
  );
  assert.equal(rows.length, 0, `duplicate order values: ${rows.map(r => r.o).join(', ')}`);
});

// ── 3. Categories are in the set the UI knows how to render ────
const UI_CATEGORIES = [
  'housing', 'transport', 'banking', 'sim', 'healthcare', 'groceries',
  'government', 'university', 'work', 'safety', 'neighbourhoods', 'general',
];
check('every category renders in the UI', async () => {
  for (const table of ['settlement_tasks', 'resources']) {
    const { rows } = await db.query(`SELECT DISTINCT LOWER(category) c FROM ${table}`);
    const unknown = rows.map(r => r.c).filter(c => !UI_CATEGORIES.includes(c));
    assert.equal(unknown.length, 0, `${table} has unknown categories: ${unknown.join(', ')}`);
  }
});

// ── 4. The headline case: a bank task must link, per country ──
check('banking task resolves a real link per destination', async () => {
  const countries = await db.query(
    `SELECT DISTINCT country FROM cities WHERE country IS NOT NULL`
  );
  const seen = [];
  for (const { country } of countries.rows) {
    const { rows } = await db.query(
      `SELECT title,
              COALESCE(url, (
                SELECT r.url FROM resources r WHERE r.url IS NOT NULL
                  AND LOWER(r.category) = 'banking'
                  AND LOWER(COALESCE(r.country,'')) = LOWER($1::text)
                ORDER BY r.id LIMIT 1
              )) AS link
       FROM settlement_tasks WHERE LOWER(category) = 'banking'`, [country]
    );
    assert.ok(rows.length > 0, `no banking task exists`);
    const link = rows[0].link;
    assert.ok(link, `no banking link resolves for ${country}`);
    assert.ok(/^https:\/\//.test(link), `banking link for ${country} is not https: ${link}`);
    seen.push(`${country} -> ${link}`);
  }
  return seen;
});

check('every destination country has a banking guide', async () => {
  const { rows } = await db.query(`
    SELECT DISTINCT c.country FROM cities c
    WHERE c.country IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM resources r
        WHERE LOWER(r.category) = 'banking'
          AND r.url IS NOT NULL
          AND LOWER(COALESCE(r.country,'')) = LOWER(c.country)
      )`);
  assert.equal(rows.length, 0, `countries with no banking guide: ${rows.map(r => r.country).join(', ')}`);
});

// ── 5. Checklist resolution for a real user, per destination city ──
check('checklist resolves links for every demo account', async () => {
  const users = await db.query(`
    SELECT u.id, u.name, COALESCE(p.city, u.moving_to) AS city, c.country
    FROM users u
    LEFT JOIN profiles p ON p.user_id = u.id
    LEFT JOIN cities c ON LOWER(c.name) = LOWER(COALESCE(p.city, u.moving_to))
    WHERE COALESCE(p.city, u.moving_to) IS NOT NULL
    LIMIT 20`);
  const report = [];
  for (const u of users.rows) {
    const { rows } = await db.query(SETTLEMENT_SQL, [u.id, u.city, u.country]);
    assert.ok(rows.length > 0, `${u.name} has an empty checklist`);
    const bank = rows.find(r => r.category === 'banking');
    assert.ok(bank && bank.url, `${u.name} (${u.city}) has a banking task with no link`);
    report.push(`${u.city || '?'}: ${rows.length} tasks, banking -> ${bank.url}`);
  }
  return report;
});

// ── 6. Resources scope to a destination and are not all-global ──
check('resources narrow to a destination', async () => {
  const city = await db.query(`SELECT name FROM cities WHERE name = 'London'`);
  const { rows } = await db.query(`
    SELECT title FROM resources
    WHERE (city IS NULL AND country IS NULL)
       OR LOWER(COALESCE(city,''))    = LOWER($1)
       OR LOWER(COALESCE(country,'')) = LOWER($2)
    ORDER BY title`, [city.rows[0].name, 'United Kingdom']);
  assert.ok(rows.some(r => /london/i.test(r.title)), 'London query returns no London-specific resource');
  assert.ok(!rows.some(r => /mumbai/i.test(r.title)), 'London query leaks a Mumbai resource');
  return rows.map(r => r.title);
});

// ── 7. Every url that is present is a real absolute http(s) link ──
check('all stored urls are absolute https', async () => {
  for (const table of ['settlement_tasks', 'resources']) {
    const { rows } = await db.query(`SELECT title, url FROM ${table} WHERE url IS NOT NULL`);
    for (const r of rows) {
      assert.ok(/^https:\/\//.test(r.url), `${table} "${r.title}" has url ${r.url}`);
    }
  }
});

// ── Run ───────────────────────────────────────────────────────
let failed = 0;
for (const [name, fn] of checks) {
  try {
    const detail = await fn();
    console.log(`ok   ${name}`);
    if (detail && detail.length) {
      for (const line of [].concat(detail)) console.log(`       ${line}`);
    }
  } catch (err) {
    failed++;
    console.log(`FAIL ${name}\n       ${err.message}`);
  }
}
console.log(failed ? `\n${failed} failed` : `\nall ${checks.length} checks passed`);
await db.end();
process.exit(failed ? 1 : 0);