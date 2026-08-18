#!/usr/bin/env node
/**
 * Compatibility wrapper. Weekday owned-social publishing is publish-owned-social.mjs
 * (Facebook + Instagram, TRAIN/VIBE/DATE rotation). IG-2026-08-17 is no longer the only post.
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), 'publish-owned-social.mjs');
const r = spawnSync(process.execPath, [script, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(r.status ?? 1);
