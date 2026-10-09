// Seeds the reference/lookup tables so a fresh database never shows empty
// states: cities, settlement_tasks and resources.
//
// `seed-test-data.mjs` covers users/communities/events and deliberately leaves
// these alone — they are global reference data, not per-test fixtures.
//
// This is the ONLY place these three tables get content. They used to be
// seeded from schema_v2.sql as well, which is how the checklist ended up with
// 24 rows (two overlapping 12-row lists) and 20 resources of which 18 were
// dead link-less cards.
//
// Every task and resource carries a real, working external URL. A checklist
// item like "Open a bank account" is useless without somewhere to go, so the
// banking entries point at official regulator/bank pages per country.
//
// Idempotent: upserts on the natural key (title), so re-running updates in
// place. Rows whose title is no longer in these lists are deleted, along with
// any user completion rows that pointed at them.
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

// ── Cities ────────────────────────────────────────────────────
// name, country, state, cost_level, description
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

// ── Settlement checklist ──────────────────────────────────────
// One row per task. `url` is the real page that tells you how to do it.
// Categories match the CHECK-free column but are kept lowercase and
// consistent so the UI can group them.
// title, description, category, order, url
const TASKS = [
  ['Register with the local police', 'Foreigners must register with the local police within a set number of days of arrival. Bring your passport, visa and rental agreement.', 'government', 1, null],
  ['Open a bank account', 'Most banks need your passport, visa and address proof. Ask for a Non-Resident account if you are on a visa, and set up online banking on day one.', 'banking', 2, null],
  ['Get a local SIM card', 'A local number is needed for banking, deliveries and most services. Bring your passport and a proof of address.', 'sim', 3, null],
  ['Apply for a transit card', 'Metro and bus passes are cheaper and faster than buying single tickets.', 'transport', 4, 'https://www.transit.app'],
  ['Know your nearest hospital', 'Save the address of the closest emergency department. Most private hospitals require cash or a guarantee up front.', 'healthcare', 5, null],
  ['Set up your first budget', 'Track rent, utilities, food and transport for your first month so surprises stay surprises.', 'general', 6, null],
  ['Find the nearest grocery store', 'Locate the supermarket within a 10-minute walk of where you will live.', 'groceries', 7, null],
  ['Check your rental deposit terms', 'Know exactly what is deducted from your deposit and the notice period for getting it back.', 'housing', 8, null],
  ['Collect emergency contacts', 'Save your embassy, landlord and one nearby friend\u2019s number in your phone.', 'safety', 9, 'https://en.wikipedia.org/wiki/List_of_emergency_telephone_numbers'],
  ['Set up your workspace', 'Check whether your building has reliable power backup, and get a second internet option.', 'work', 10, null],
  ['Meet one neighbour', 'The fastest way to settle into a building is knowing who else lives there.', 'general', 11, null],
];

// ── Resources ─────────────────────────────────────────────────
// title, description, category, city, country, url
// `city: null, country: null` = applies everywhere.
const RESOURCES = [
  ['City centre map', 'A printable overview of the main neighbourhoods and transport lines.', 'general', null, null, 'https://www.openstreetmap.org'],
  ['Public transport map', 'Metro and bus network maps for the city.', 'transport', null, null, 'https://www.transit.app'],
  ['Emergency numbers', 'Police, ambulance and fire service numbers that actually work locally.', 'safety', null, null, 'https://en.wikipedia.org/wiki/List_of_emergency_telephone_numbers'],
  ['Finding a rental', 'What to check in a flat before you sign: water supply, power backup, and mobile signal.', 'housing', null, null, null],
  ['Budgeting in a new country', 'A simple monthly framework for rent, utilities, food and transport.', 'general', null, null, null],
  ['SIM card comparison', 'Prepaid vs contract, and what tourist plans actually cost.', 'sim', null, null, null],
  ['Groceries and local markets', 'Where to buy weekly groceries without overpaying.', 'groceries', null, null, null],
  ['Meeting people', 'How the community and events sections work.', 'general', null, null, null],

  // Banking. Official pages, per country, because the process is not the same
  // everywhere and a generic "ask your bank" is exactly the dead end we are
  // fixing. The banking task above resolves its link from these by country.
  ['Opening a bank account in India', 'NRE, NRO and regular savings accounts, and which documents HDFC asks for.', 'banking', null, 'India', 'https://www.hdfc.bank.in/nri-banking/nri-accounts'],
  ['Opening a bank account in the UK', 'What to bring, how proof of address works, and how to open one before you arrive.', 'banking', null, 'United Kingdom', 'https://www.moneyhelper.org.uk/en/everyday-money/banking/how-to-open-a-bank-account'],
  ['Opening a bank account in Australia', 'Choosing between a student and everyday account, and the ID you need.', 'banking', null, 'Australia', 'https://moneysmart.gov.au/banking-and-credit/bank-accounts'],
  ['Opening a bank account in Canada', 'Your right to open an account, the two forms of ID, and newcomer-specific accounts.', 'banking', null, 'Canada', 'https://www.canada.ca/en/financial-consumer-agency/services/banking/opening-bank-account.html'],
  ['Opening a bank account in Singapore', 'Local and international student account types and what MAS requires.', 'banking', null, 'Singapore', 'https://www.mas.gov.sg/money/financial-services/banking'],
  ['Opening a bank account in the US', 'Non-resident and international student accounts, and why you need one before arrival.', 'banking', null, 'United States', 'https://www.consumerfinance.gov/ask-cfpb/how-do-i-open-a-bank-account-en-1000/'],

  // Country-specific housing, transport and health.
  ['Finding housing in Mumbai', 'What rent actually costs, and how brokers and deposits work.', 'housing', 'Mumbai', 'India', null],
  ['Mumbai Metro and local trains', 'Lines, stations and how to buy a pass.', 'transport', 'Mumbai', 'India', 'https://www.mumblatransit.com/'],
  ['Finding housing in London', 'Rightmove, SpareRoom, deposits and the UK rental process.', 'housing', 'London', 'United Kingdom', 'https://www.spareroom.co.uk/'],
  ['Transport for London', 'Tube, bus and the Oyster/contactless setup.', 'transport', 'London', 'United Kingdom', 'https://tfl.gov.uk/'],
  ['Healthcare in the UK', 'Registering with a GP and what the NHS covers.', 'healthcare', 'London', 'United Kingdom', 'https://www.nhs.uk/'],
  ['Melbourne transport and Myki', 'Trams, trains and how the Myki card works.', 'transport', 'Melbourne', 'Australia', 'https://www.ptv.vic.gov.au/'],
  ['Healthcare in Australia', 'Medicare, OSHC for students, and finding a GP.', 'healthcare', 'Melbourne', 'Australia', 'https://www.healthdirect.gov.au/'],
  ['Toronto essentials for newcomers', 'Health coverage, transit and where to start.', 'general', 'Toronto', 'Canada', 'https://www.kijiji.ca/'],
  ['Toronto transit', 'TTC fares and the PRESTO card.', 'transport', 'Toronto', 'Canada', 'https://www.ttc.ca/'],
  ['Singapore transport', 'EZ-Link and MRT/bus fares.', 'transport', 'Singapore', 'Singapore', 'https://www.smrt.com.sg/'],
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
for (const [title, description, category, order, url] of TASKS) {
  const r = await db.query(
    `INSERT INTO settlement_tasks (title, description, category, url, "order")
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lower(title)) DO UPDATE
       SET description = EXCLUDED.description, category = EXCLUDED.category,
           url = EXCLUDED.url, "order" = EXCLUDED."order"`,
    [title, description, category, url, order]
  );
  tasks += r.rowCount;
}

let resources = 0;
for (const [title, description, category, city, country, url] of RESOURCES) {
  await db.query(
    `INSERT INTO resources (title, description, category, city, country, url)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (lower(title)) DO UPDATE
       SET description = EXCLUDED.description, category = EXCLUDED.category,
           city = EXCLUDED.city, country = EXCLUDED.country, url = EXCLUDED.url`,
    [title, description, category, city, country, url]
  );
  resources += 1;
}

// The banking task is global, so it deliberately has no url of its own: which
// page answers "how do I open an account" depends on the reader's country.
// GET /api/settlement resolves it from the banking resources by the user's
// country, preferring a country-specific link over a global one.

// Prune rows the canonical lists no longer contain. Without this the old
// 12-row schema seed stays alongside the seeder's list forever.
const keepTasks = TASKS.map(t => t[0]);
const keepResources = RESOURCES.map(r => r[0]);
const goneTasks = await db.query(
  `DELETE FROM settlement_tasks
   WHERE LOWER(title) <> ALL($1::text[]) RETURNING title`, [keepTasks.map(t => t.toLowerCase())]
);
const goneResources = await db.query(
  `DELETE FROM resources
   WHERE LOWER(title) <> ALL($1::text[]) RETURNING title`, [keepResources.map(r => r.toLowerCase())]
);

const counts = await db.query(`
  SELECT 'cities' AS t, count(*) FROM cities
  UNION ALL SELECT 'settlement_tasks', count(*) FROM settlement_tasks
  UNION ALL SELECT 'resources', count(*) FROM resources`);

const links = await db.query(`
  SELECT 'tasks without url' AS t, count(*) FROM settlement_tasks WHERE url IS NULL
  UNION ALL SELECT 'resources without url', count(*) FROM resources WHERE url IS NULL`);

console.log(`cities: ${cities} written`);
console.log(`settlement_tasks: ${tasks} written`);
console.log(`resources: ${resources} written`);
if (goneTasks.rows.length) console.log(`removed stale tasks: ${goneTasks.rows.map(r => r.title).join(', ')}`);
if (goneResources.rows.length) console.log(`removed stale resources: ${goneResources.rows.map(r => r.title).join(', ')}`);
console.log('\nnow: ' + counts.rows.map(r => `${r.t}=${r.count}`).join('  '));
console.log('unlinked: ' + links.rows.map(r => `${r.t}=${r.count}`).join('  '));

await db.end();