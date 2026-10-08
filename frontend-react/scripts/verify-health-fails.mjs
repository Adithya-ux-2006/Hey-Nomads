// Verifies /api/health fails LOUDLY when DATABASE_URL is broken.
// Loads a deliberately bad connection string, so we can prove the endpoint
// returns 503 instead of a hardcoded {ok:true}.
//
// Usage: node scripts/verify-health-fails.mjs
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 3199;
process.env.DATABASE_URL = 'postgresql://nobody:nopass@127.0.0.1:1/nope';
process.env.LOCAL_API_PORT = String(PORT);

const { default: handler } = await import('../api/index.js');

const server = http.createServer(handler);
await new Promise(r => server.listen(PORT, r));

function get() {
  return new Promise(resolve => {
    http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', e => resolve({ status: 0, body: e.message }));
  });
}

const { status, body } = await get();
console.log(`GET /api/health -> HTTP ${status}`);
console.log(`body: ${body}`);

const parsed = JSON.parse(body);
const loud = status === 503 && parsed.ok === false && typeof parsed.error === 'string' && parsed.error.length > 0;

console.log(`\nreturned 503:            ${status === 503}`);
console.log(`ok === false:            ${parsed.ok === false}`);
console.log(`carries a reason:        ${Boolean(parsed.error)}`);
console.log(`leaks credentials:       ${body.includes('nopass') || body.includes('nobody')}`);
console.log(`\n${loud ? 'PASS' : 'FAIL'}: a broken DATABASE_URL is now visible instead of silent`);

server.close();
process.exit(loud ? 0 : 1);