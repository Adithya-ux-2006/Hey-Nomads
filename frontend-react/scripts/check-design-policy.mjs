// Verifies the apple-design skill family is installed and readable, and that the
// repository carries a permanent design policy that points at the upstream repo.
//
//   node scripts/check-design-policy.mjs
import fs from 'fs';
import os from 'os';
import path from 'path';

const WANT = ['apple-design', 'apple-design-foundations', 'apple-design-interaction',
  'apple-design-tactics', 'apple-design-motion', 'apple-design-materials',
  'apple-design-web', 'apple-design-os', 'apple-design-backend'];

const checkout = path.join(os.homedir(), '.config', 'opencode', 'vendor', 'apple-design-skills', 'skills');
const repo = path.resolve(process.cwd(), '..');

const have = WANT.filter(n => fs.existsSync(path.join(checkout, n, 'SKILL.md')));
console.log('skills present:', have.length, 'of', WANT.length);
console.log(have.sort().join(' '));
const missing = WANT.filter(n => !have.includes(n));
if (missing.length) console.log('missing:', missing.join(' '));

console.log('\npolicy files:');
let bad = 0;
for (const f of ['AGENTS.md', 'docs/design-system/apple-design-policy.md']) {
  const p = path.join(repo, f);
  const exists = fs.existsSync(p);
  const body = exists ? fs.readFileSync(p, 'utf8') : '';
  const refs = body.includes('apple-design-skills');
  console.log(`  ${exists && refs ? 'ok  ' : 'FAIL'} ${f}  ${exists ? body.length : 0} bytes  ${refs ? 'references upstream' : 'MISSING upstream reference'}`);
  if (!exists || !refs) bad++;
}

process.exit(have.length === WANT.length && bad === 0 ? 0 : 1);