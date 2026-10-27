/**
 * Ensure growth script dependencies are installed.
 * Cloud automation worktrees often skip `npm i --prefix scripts/growth`.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const GROWTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const REQUIRED = ['google-auth-library', 'sharp'];
const growthRequire = createRequire(path.join(GROWTH_DIR, 'package.json'));

async function tryImport(name) {
  try {
    await import(name);
    return true;
  } catch {
    try {
      const resolved = growthRequire.resolve(name);
      await import(pathToFileURL(resolved).href);
      return true;
    } catch {
      return false;
    }
  }
}

function runNpmInstall() {
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const args = ['i', '--prefix', GROWTH_DIR, '--ignore-scripts', '--no-fund', '--no-audit'];
  let r = spawnSync(npmCmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    shell: process.platform === 'win32'
  });
  if (r.error || r.status !== 0) {
    r = spawnSync('npm', args, {
      encoding: 'utf8',
      stdio: 'pipe',
      shell: true
    });
  }
  return r;
}

export async function ensureGrowthDeps() {
  const missing = [];
  for (const name of REQUIRED) {
    if (!(await tryImport(name))) missing.push(name);
  }
  if (!missing.length) return { ok: true, installed: false, missing: [] };

  const r = runNpmInstall();
  if (r.status !== 0) {
    return {
      ok: false,
      installed: false,
      missing,
      error: (r.stderr || r.stdout || r.error?.message || 'npm install failed').slice(0, 400)
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
      missing: stillMissing,
      error: `Missing after install: ${stillMissing.join(', ')}`
    };
  }
  return { ok: true, installed: true, missing: [] };
}
