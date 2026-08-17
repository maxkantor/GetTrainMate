#!/usr/bin/env node
/**
 * Compatibility wrapper:
 *   node scripts/growth/growth-run-lock.mjs acquire
 *   node scripts/growth/growth-run-lock.mjs release [--force]
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cmd = String(process.argv[2] || '').toLowerCase();
const extra = process.argv.slice(3);
const script =
  cmd === 'acquire'
    ? path.join(__dirname, 'acquire-growth-lock.mjs')
    : cmd === 'release'
      ? path.join(__dirname, 'release-growth-lock.mjs')
      : null;

if (!script) {
  console.error('Usage: node scripts/growth/growth-run-lock.mjs <acquire|release> [--force]');
  process.exit(1);
}

const r = spawnSync(process.execPath, [script, ...extra], { stdio: 'inherit' });
process.exit(r.status ?? 1);
