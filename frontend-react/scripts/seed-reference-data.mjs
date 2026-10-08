// Seeds the reference/lookup tables so a fresh database never shows empty
// states: cities, settlement_tasks and resources.
//
// `seed-test-data.mjs` covers users/communities/events and deliberately leaves
// these alone — they are global reference data, not per-test fixtures.
//
// Idempotent: safe to re-run. Cities upsert on (name, country); settlement
// tasks and resources are keyed on their natural title.
//
// Usage:
//   cd frontend-react
//   node --import ./scripts/dns-shim.mjs scripts/seed-reference-data.mjs
//   node scripts/seed-reference-data.mjs          # where DNS is unrestricted
import fs from 'fs';
import path from 'path';
import pg from 'pg';

for (const line of fs.readFileSync(path.resolve(process.cwd(), '.env'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const CITIES = [
  ['Mumbai', 'India', 'Maharashtra', 4, 'India\u2019s commercial capital. Rent runs high, neighbourhoods are compact, and the monsoon makes indoor life the default.'],
  ['Bangalore', 'India', 'Karnataka', 4, 'India\u2019s tech hub. Outer areas are cheap and spacious; traffic decides your commute more than rent does.'],
  ['Delhi', 'India', 'Delhi', 4, 'Huge, loud, and spread out. North and south feel like different cities.'],
  ['Pune', 'India', 'Maharashtra', 3, 'Quieter than Mumbai with a large student population and steady IT work.'],
  ['Hyderabad', 'India', 'Telangana', 3, 'Affordable, well-planned, and a big established food scene.'],
  ['Chennai', 'India', 'Tamil Nadu', 3, 'Flat, coastal, and deeply food-obsessed. Very liveable on a modest budget.'],
  ['London', 'United Kingdom', 'England', 5, 'Expensive and cramped, but everything is on a train or a tube.'],
  ['Melbourne', 'Australia', 'Victoria', 4, 'Consistently ranked one of the world\u2019s most liveable cities. Great coffee, worse rent.'],
  ['Toronto', 'Canada', 'Ontario', 4, 'Multicultural, cold, and expensive. Strong newcomer community.'],
  ['Singapore', 'Singapore', '', 5, 'The most expensive city on this list, and the safest and most convenient.'],
];

const TASKS = [
  ['Register with the local police', 'Foreigners must register with the local police within a set number of days of arrival. Bring your passport, visa and rental agreement.', 'Paperwork', 1],
  ['Get a local SIM card', 'A local number is needed for banking, deliveries and most services. Bring your passport and a proof of address.', 'Connectivity', 2],
  ['Open a bank account', 'Most banks need your passport, visa and address proof. Ask for an International Student or Non-Resident account if you are on a visa.', 'Banking', 3],
  ['Apply for a transit card', 'Metro and bus passes are cheaper and faster than buying single tickets.', 'Transport', 4],
  ['Know your nearest hospital', 'Save the address of the closest emergency department. Most private hospitals require cash or a guarantee up front.', 'Healthcare', 5],
  ['Set up your first budget', 'Track rent, utilities, food and transport for your first month so surprises stay surprises.', 'Money', 6],
  ['Find the nearest grocery store', 'Locate the supermarket within a 10-minute walk of where you will live.', 'Groceries', 7],
  ['Check your rental deposit terms', 'Know exactly what is deducted from your deposit and the notice period for getting it back.', 'Housing', 8],
  ['Get a local SIM sorted before arrival', 'Roaming eats budget fast. Activate a local number on arrival.', 'Connectivity', 9],
  ['Collect emergency contacts', 'Save your embassy, landlord and one nearby friend\u2019s number in your phone.', 'Safety', 10],
  ['Set up your workspace', 'Check whether your building has reliable power backup, and get a second internet option.', 'Housing', 11],
  ['Meet one neighbour', 'The fastest way to settle into a building is knowing who else lives there.', 'Community', 12],
];

const RESOURCES = [
  ['City centre map', 'A printable overview of the main neighbourhoods and transport lines.', 'general', null, null, 'https://www.openstreetmap.org'],
  ['Public transport map', 'Metro and bus network maps for the city.', 'transport', null, null, 'https://www.transit.app'],
  ['Emergency numbers', 'Police, ambulance and fire service numbers that actually work locally.', 'safety', null, null, null],
  ['Finding a rental', 'What to check in a flat before you sign: water supply, power backup, and mobile signal.', 'housing', null, null, null],
  ['Opening a bank account', 'What documents banks usually ask a new arrival for.', 'banking', null, null, null],
  ['Budgeting in a new country', 'A simple monthly framework for rent, utilities, food and transport.', 'general', null, null, null],
  ['SIM card comparison', 'Prepaid vs contract, and what tourist plans actually cost.', 'sim', null, null, null],
  ['Healthcare for newcomers', 'Public vs private care, and what insurance to get first.', 'healthcare', null, null, null],
  ['Groceries and local markets', 'Where to buy weekly groceries without overpaying.', 'groceries', null, null, null],
  ['Meeting people', 'How the community and events sections work.', 'general', null, null, null],
];

const db = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  await db.connect();
} catch (err) {
  console.error('Could not connect. Is DATABASE_URL set?', err.message);
  process.exit(1);
}

let cities = 0;
for (const [name, country, state, cost, description] of CITIES) {
  const r = await db.query(
    `INSERT INTO cities (name, country, state, cost_level, description)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lower(name), lower(country)) DO UPDATE
       SET state = EXCLUDED.state, cost_level = EXCLUDED.cost_level, description = EXCLUDED.description`,
    [name, country, state, cost, description]
  );
  cities += r.rowCount;
}

let tasks = 0;
for (const [title, description, category, order] of TASKS) {
  const existing = await db.query('SELECT id FROM settlement_tasks WHERE title = $1', [title]);
  if (existing.rows.length) continue;
  await db.query(
    'INSERT INTO settlement_tasks (title, description, category, "order") VALUES ($1, $2, $3, $4)',
    [title, description, category, order]
  );
  tasks += 1;
}

let resources = 0;
for (const [title, description, category, city, country, url] of RESOURCES) {
  const existing = await db.query('SELECT id FROM resources WHERE title = $1', [title]);
  if (existing.rows.length) continue;
  await db.query(
    'INSERT INTO resources (title, description, category, city, country, url) VALUES ($1, $2, $3, $4, $5, $6)',
    [title, description, category, city, country, url]
  );
  resources += 1;
}

const counts = await db.query(`
  SELECT 'cities' AS t, count(*) FROM cities
  UNION ALL SELECT 'settlement_tasks', count(*) FROM settlement_tasks
  UNION ALL SELECT 'resources', count(*) FROM resources`);

console.log(`cities: ${cities} written`);
console.log(`settlement_tasks: ${tasks} added`);
console.log(`resources: ${resources} added`);
console.log('\nnow: ' + counts.rows.map(r => `${r.t}=${r.count}`).join('  '));

await db.end();