/**
 * Ensure growth script dependencies (google-auth-library) are installed.
 * Cloud automation worktrees often skip `npm i --prefix scripts/growth`.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const GROWTH_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function ensureGrowthDeps() {
  try {
    await import('google-auth-library');
    return { ok: true, installed: false };
  } catch {
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
    try {
      await import('google-auth-library');
      return { ok: true, installed: true };
    } catch (e) {
      return {
        ok: false,
        installed: false,
        error: e instanceof Error ? e.message : String(e)
      };
    }
  }
}
