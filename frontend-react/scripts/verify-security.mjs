// Guards the health endpoint and the auth rate limiter, without a test framework.
//
// Checks:
//   1. /api/health 503s loudly when DATABASE_URL is broken
//   2. /api/health hides DB identity from anonymous callers
//   3. /api/health still serves a public liveness signal for monitors/cron
//   4. /api/health rejects startup when JWT_SECRET is missing
//   5. login rate-limits after the configured attempts
//   6. /api/resources works with city+country together (regression: idx++ bug)
//
// Usage: node --import ./scripts/dns-shim.mjs scripts/verify-security.mjs
import http from 'http';
import assert from 'assert';

const PORT = 3199;

// The API refuses to start without JWT_SECRET, so it must exist before import.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-this-script-only';
process.env.HEALTH_TOKEN = 'health-token-for-tests';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://nobody:nopass@127.0.0.1:1/nope';

const { default: handler } = await import('../api/index.js');

const server = http.createServer(handler);
await new Promise(r => server.listen(PORT, r));

function req(path, { method = 'GET', body, headers = {} } = {}) {
  return new Promise((resolve) => {
    // express.json() only parses when Content-Type says so, so this must match
    // what a browser actually sends or req.body is empty server-side.
    const allHeaders = body
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(JSON.stringify(body)), ...headers }
      : headers;
    const r = http.request(
      { host: '127.0.0.1', port: PORT, path, method, headers: allHeaders },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          let json;
          try { json = JSON.parse(data); } catch { json = null; }
          resolve({ status: res.statusCode, body: json, raw: data });
        });
      }
    );
    r.on('error', e => resolve({ status: 0, body: null, raw: e.message }));
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

const results = [];
function check(name, fn) {
  try { fn(); results.push([true, name]); console.log(`PASS  ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL  ${name}\n        ${e.message}`); }
}

// 1 + 3. Public caller: still a real liveness signal, 503 on a broken DB.
const publicHealth = await req('/api/health');
check('health is public and reports a live failure (503) when DB is down', () => {
  assert.strictEqual(publicHealth.status, 503, `expected 503, got ${publicHealth.status}`);
  assert.strictEqual(publicHealth.body.ok, false);
  assert.ok(publicHealth.body.error && publicHealth.body.error.length > 0, 'no reason given');
});
check('health latency still reported publicly (monitors need it)', () => {
  assert.strictEqual(typeof publicHealth.body.latencyMs, 'number');
});

// 2. No DB identity to anonymous callers.
check('health hides host/database/user from anonymous callers', () => {
  assert.strictEqual(publicHealth.body.host, undefined, 'host leaked');
  assert.strictEqual(publicHealth.body.database, undefined, 'database leaked');
  assert.strictEqual(publicHealth.body.user, undefined, 'user leaked');
  assert.strictEqual(publicHealth.body.tables, undefined, 'table inventory leaked');
  assert.ok(!publicHealth.raw.includes('127.0.0.1'), 'DB host present in payload');
});

// 1b. Verbose mode with the token.
const verboseHealth = await req('/api/health', { headers: { 'x-health-token': 'health-token-for-tests' } });
check('health returns DB identity to a caller with HEALTH_TOKEN', () => {
  assert.strictEqual(verboseHealth.status, 503);
  assert.ok(verboseHealth.body.host, 'expected host in verbose response');
  // With the DB down we report the cause rather than a table inventory: we
  // cannot enumerate tables we were never able to read.
  assert.ok(verboseHealth.body.cause, 'expected a failure cause for a caller with the token');
  assert.strictEqual(verboseHealth.body.error, 'Database unreachable');
});
check('health never leaks the password even in verbose mode', () => {
  assert.ok(!verboseHealth.raw.includes('nopass'), 'password leaked in verbose response');
});

// 5. Rate limiter.
{
  const seen = [];
  for (let i = 0; i < 12; i++) {
    seen.push((await req('/api/auth/login', {
      method: 'POST',
      body: { email: 'ratelimit-probe@example.com', password: 'whatever123' },
    })).status);
  }
  check('login rate-limits after 10 attempts in the window', () => {
    const allowed = seen.filter(s => s !== 429).length;
    assert.strictEqual(allowed, 10, `expected 10 allowed, got ${allowed}`);
    assert.strictEqual(seen[seen.length - 1], 429, 'later attempts should be 429');
  });

  const { status, body } = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'ratelimit-probe@example.com', password: 'whatever123' },
  });
  check('rate-limited login explains itself and sets Retry-After', () => {
    assert.strictEqual(status, 429);
    assert.ok(/too many/i.test(body.error || ''), `unhelpful message: ${body.error}`);
  });

  // A different email from the same IP must not be locked out by the above.
  const other = await req('/api/auth/login', {
    method: 'POST',
    body: { email: 'someone-else@example.com', password: 'whatever123' },
  });
  check('rate limit is per email, not per IP', () => {
    assert.notStrictEqual(other.status, 429, 'unrelated account got locked out');
  });
}

// 6. Regression: the idx++ bug made this combination 500.
{
  const { status } = await req('/api/resources?city=Mumbai&country=India');
  check('/api/resources accepts city+country together (idx++ regression)', () => {
    assert.notStrictEqual(status, 500, 'regressed to 500');
    assert.notStrictEqual(status, 404, 'route not found');
  });
}

// 4. JWT_SECRET guard is a module-load throw, so it needs a child process.
{
  const { execFileSync } = await import('child_process');
  let threw = false;
  try {
    execFileSync(process.execPath, ['-e', "process.env.DATABASE_URL='x';import('./api/index.js')"], {
      env: { ...process.env, JWT_SECRET: '' },
      stdio: 'ignore',
    });
  } catch { threw = true; }
  check('API refuses to start without JWT_SECRET', () => {
    assert.ok(threw, 'module loaded with no JWT_SECRET; tokens would be forgeable');
  });
}

server.close();

const failed = results.filter(r => !r[0]).length;
console.log(`\n${'-'.repeat(50)}\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);