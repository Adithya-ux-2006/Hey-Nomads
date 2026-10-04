// Local API harness for testing the real serverless handler outside Vercel.
// Serves the exact same handler that api/index.js exports as a Vercel
// function: `export default (req, res) => app(req, res)`.
//
// Usage:
//   cd frontend-react
//   node --import ./scripts/dns-shim.mjs scripts/local-api.mjs
//
// Env (DATABASE_URL, JWT_SECRET) is loaded from .env — same source the
// deployment uses.
import fs from 'fs';
import http from 'http';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const PORT = Number(process.env.LOCAL_API_PORT) || 3100;
const { default: handler } = await import('../api/index.js');

http.createServer(handler).listen(PORT, () => {
  console.log(`🟢 Real Hey Nomads API handler listening on http://localhost:${PORT}`);
  console.log(`   (same file as the Vercel function: api/index.js)`);
});