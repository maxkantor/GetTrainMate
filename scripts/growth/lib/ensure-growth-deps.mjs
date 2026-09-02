/**
 * Ensure growth script dependencies are installed.
 * Cloud automation worktrees often skip `npm i --prefix scripts/growth`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GROWTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = ['google-auth-library', 'sharp'];

async function tryImport(name) {
  try {
    await import(name);
    return true;
  } catch {
    return false;
  }
}

export async function ensureGrowthDeps() {
  const missing = [];
  for (const name of REQUIRED) {
    if (!(await tryImport(name))) missing.push(name);
  }
  if (!missing.length) return { ok: true, installed: false };

  const r = spawnSync('npm', ['i', '--prefix', GROWTH_DIR, '--ignore-scripts'], {
    encoding: 'utf8',
    stdio: 'pipe'
  });
  if (r.status !== 0) {
    return {
      ok: false,
      installed: false,
      error: (r.stderr || r.stdout || 'npm install failed').slice(0, 300)
    };
  }
  const stillMissing = [];
  for (const name of REQUIRED) {
    if (!(await tryImport(name))) stillMissing.push(name);
  }
  if (stillMissing.length) {
    return {
      ok: false,
      installed: false,
      error: `Missing after install: ${stillMissing.join(', ')}`
    };
  }
  return { ok: true, installed: true };
}
