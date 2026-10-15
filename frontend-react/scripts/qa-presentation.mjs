// Entry point for the competition-presentation gate.
//
// The scenario itself runs as a qa-local suite so it inherits the same
// test-database guard, server lifecycle and port checks as every other suite;
// this file only selects that suite and forwards its output and exit status.
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const child = spawn(process.execPath, ['scripts/qa-local.mjs', '--suite', 'presentation'], {
  cwd,
  stdio: 'inherit',
  env: process.env,
});

child.on('error', err => {
  console.error(`presentation harness could not start: ${err.message}`);
  process.exit(1);
});
child.on('close', code => process.exit(code === null || code === undefined ? 1 : code));
