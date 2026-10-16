// Offline gate dispatcher for GATES.gender-prefs.md. Each subcommand runs its
// own CHECK and prints the gate's success token only on success.
//
//   node scripts/gates-gender-prefs.mjs unit|api|ui|docs
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
  console.log('GATE_GENDER_UNIT_OK');
} else if (mode === 'api') {
  run('node', ['scripts/offline-api-gates.mjs', 'genderprefs']);
  // Re-run the pure predicate tests so this gate, not only G3, carries them.
  run('node', ['--test', 'tests/offline/gender-prefs.test.mjs']);
  console.log('GATE_GENDER_API_OK');
} else if (mode === 'ui') {
  run('node', ['scripts/qa-offline-ui.mjs']);
  console.log('GATE_GENDER_UI_OK');
} else if (mode === 'docs') {
  const docPath = path.join(process.cwd(), '..', 'docs', 'matching-formula.md');
  let doc;
  try {
    doc = readFileSync(docPath, 'utf8');
  } catch {
    console.error(`missing ${docPath}`);
    process.exit(1);
  }
  const REQUIRED = [
    'Gender preference filter',
    'Two-sided rule',
    'Prefer not to specify',
    'no_preference',
    'discover',
    'roommates/recommended',
    'Positive control',
  ];
  const missing = REQUIRED.filter(needle => !doc.includes(needle));
  if (missing.length) {
    console.error(`matching-formula.md is missing: ${missing.join(', ')}`);
    process.exit(1);
  }
  // Positive control: the same predicate that just passed must reject a copy
  // with the section name removed — the checker is not vacuous.
  const mentionsSection = text => text.includes('Gender preference filter');
  const mutated = doc.replaceAll('Gender preference filter', 'REMOVED_FOR_CONTROL');
  if (!mentionsSection(doc) || mentionsSection(mutated)) {
    console.error('positive control failed: the checker cannot detect a missing section');
    process.exit(1);
  }
  console.log('GATE_GENDER_DOCS_OK');
} else {
  console.error('usage: gates-gender-prefs.mjs unit|api|ui|docs');
  process.exit(1);
}
