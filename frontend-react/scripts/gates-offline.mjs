// Offline gate dispatcher for GATES.offline.md. Each subcommand runs its own
// CHECK and prints the gate's success token only on success.
//
//   node scripts/gates-offline.mjs unit|upload|likes|ui|docs|push
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const mode = process.argv[2];

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: process.cwd() });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

if (mode === 'unit') {
  run('node', ['--test', 'tests/offline/*.test.mjs']);
  console.log('GATE_OFFLINE_UNIT_OK');
} else if (mode === 'upload') {
  run('node', ['scripts/offline-api-gates.mjs', 'upload']);
  console.log('GATE_UPLOAD_GUARDS_OK');
} else if (mode === 'likes') {
  run('node', ['scripts/offline-api-gates.mjs', 'likes']);
  // Re-run the builder assertions so this gate, not only G3, carries them.
  run('node', ['--test', 'tests/offline/likes-queries.test.mjs']);
  console.log('GATE_LIKES_API_OK');
} else if (mode === 'ui') {
  run('node', ['scripts/qa-offline-ui.mjs']);
  console.log('GATE_OFFLINE_UI_OK');
} else if (mode === 'docs') {
  const docPath = path.join(process.cwd(), '..', 'docs', 'offline-backend-checklist.md');
  let doc;
  try {
    doc = readFileSync(docPath, 'utf8');
  } catch {
    console.error(`missing ${docPath}`);
    process.exit(1);
  }
  const REQUIRED = [
    'BLOB_READ_WRITE_TOKEN',      // the env var the live upload needs
    'npm run verify:api',         // blocked DB-backed verification
    'isolated test database',     // what every DB-backed run requires
    'production database',        // what needs explicit human approval
    'vercel env ls',              // how to inspect deployed env var names
    'Reproduction steps',         // the exact handoff sequence
    'Positive control',           // proof this checker can fail
  ];
  const missing = REQUIRED.filter(needle => !doc.includes(needle));
  if (missing.length) {
    console.error(`checklist is missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Positive control: the same predicate that just passed must reject a copy
  // with the required token name removed — the checker is not vacuous.
  const mentionsBlobToken = text => text.includes('BLOB_READ_WRITE_TOKEN');
  const mutated = doc.replaceAll('BLOB_READ_WRITE_TOKEN', 'REMOVED_FOR_CONTROL');
  if (!mentionsBlobToken(doc) || mentionsBlobToken(mutated)) {
    console.error('positive control failed: the checker cannot detect a missing token line');
    process.exit(1);
  }
  console.log('GATE_CHECKLIST_OK');
} else if (mode === 'push') {
  const local = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: process.cwd() });
  if (local.status !== 0) {
    console.error(local.stderr || 'git rev-parse failed');
    process.exit(1);
  }
  const remote = spawnSync('git', ['ls-remote', 'origin', 'refs/heads/main'], { encoding: 'utf8', cwd: process.cwd() });
  if (remote.status !== 0) {
    console.error(remote.stderr || 'git ls-remote failed — is origin reachable?');
    process.exit(1);
  }
  const remoteSha = (remote.stdout || '').trim().split(/\s+/)[0];
  const localSha = local.stdout.trim();
  if (!remoteSha || localSha !== remoteSha) {
    console.error(`local main head ${localSha} != pushed origin/main ${remoteSha || '(missing)'} — commit and push first`);
    process.exit(1);
  }
  console.log('GATE_PUSH_OK');
} else {
  console.error('usage: gates-offline.mjs unit|upload|likes|ui|docs|push');
  process.exit(1);
}
