// Guards the deploy contract that broke both hosts at least once.
//
// The backend is a Vercel serverless function, so a static host needs an
// explicit /api/* proxy. Getting the rule order wrong silently sends every API
// call to the SPA shell instead, which looks like "the site loads but nothing
// works". This asserts the ordering, not just the presence.
//
// Portable Node on purpose: stock Windows PowerShell has no grep/tail/tr, and a
// gate that cannot run on the maintainer's machine is not evidence.
import fs from 'fs';
import path from 'path';
import assert from 'node:assert';

const root = path.resolve(process.cwd(), '..');
const tomlPath = path.join(root, 'netlify.toml');
assert.ok(fs.existsSync(tomlPath), `netlify.toml missing at ${tomlPath}`);

const toml = fs.readFileSync(tomlPath, 'utf8');
const blocks = [...toml.matchAll(/\[\[redirects\]\]([\s\S]*?)(?=\n\[|$)/g)].map(m => m[1]);

const api = blocks.find(b => /from\s*=\s*"\/api\/\*"/.test(b));
assert.ok(api, 'no [[redirects]] rule proxies /api/*, so auth will 404 on a static host');
assert.ok(/status\s*=\s*200/.test(api), 'the /api/* proxy must rewrite (status 200), not redirect');
assert.ok(/force\s*=\s*true/.test(api), 'the /api/* proxy needs force=true to beat the SPA catch-all');

const target = api.match(/to\s*=\s*"([^"]+)"/)[1];
assert.ok(/^https:\/\//.test(target), `proxy target must be absolute https, got ${target}`);
assert.ok(target.includes(':splat'), `proxy target must forward the path, got ${target}`);

// Netlify applies the FIRST matching rule. If the SPA catch-all is declared
// first, /api/* never reaches the backend.
const apiIdx = blocks.indexOf(api);
const spaIdx = blocks.findIndex(b => /from\s*=\s*"\/\*"/.test(b));
assert.ok(spaIdx !== -1, 'expected an SPA catch-all redirect for client-side routing');
assert.ok(apiIdx < spaIdx, 'the /api/* proxy must be declared BEFORE the /* SPA catch-all');

const baseMatch = toml.match(/base\s*=\s*"([^"]+)"/);
assert.ok(baseMatch, 'netlify.toml must declare base; the app is not at the repo root');
assert.ok(fs.existsSync(path.join(root, baseMatch[1], 'package.json')),
  `base "${baseMatch[1]}" has no package.json, so the build runs in the wrong directory`);

// The proxy is only useful if the backend it forwards to is actually alive.
const health = await fetch(`${new URL('/api/health', target)}`, { signal: AbortSignal.timeout(20000) });
assert.equal(health.status, 200, `proxy target returned ${health.status}, expected 200`);

const body = await health.json();
assert.equal(body.ok, true, `proxy target health check reports ok=${body.ok}`);

console.log(`deploy contract ok: ${target}`);
console.log('deploy contract verification passed');