#!/usr/bin/env -S npx tsx
/**
 * Compare leaf translation keys across web locales vs en.ts.
 * Usage: node scripts/audit-i18n.mjs [--fail-on-missing]
 */
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'apps/web/src/i18n/locales');

const LOCALES = ['en', 'es', 'ru', 'ua', 'hi', 'zh', 'fr', 'de'];
const failOnMissing = process.argv.includes('--fail-on-missing');

function leafKeys(obj, prefix = '') {
  const out = new Map();
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of leafKeys(v, p)) out.set(ck, cv);
    } else {
      out.set(p, v);
    }
  }
  return out;
}

async function loadLocale(code) {
  const mod = await import(pathToFileURL(path.join(LOCALES_DIR, `${code}.ts`)).href);
  return mod[code];
}

const en = await loadLocale('en');
const enKeys = leafKeys(en);
const enStrings = new Map(enKeys);

let exitCode = 0;
const report = [];

for (const code of LOCALES) {
  if (code === 'en') continue;
  const loc = await loadLocale(code);
  const locKeys = leafKeys(loc);
  const missing = [];
  const identical = [];

  for (const [key, enVal] of enStrings) {
    if (!locKeys.has(key)) missing.push(key);
    else if (typeof enVal === 'string' && locKeys.get(key) === enVal && enVal.trim().length > 2) {
      identical.push(key);
    }
  }

  report.push({
    locale: code,
    total: locKeys.size,
    missing: missing.length,
    identical: identical.length,
    missingSample: missing.slice(0, 15),
    identicalSample: identical.slice(0, 15),
  });

  if (missing.length) exitCode = 1;
}

console.log(JSON.stringify({ enKeyCount: enKeys.size, locales: report }, null, 2));

for (const row of report) {
  console.log(
    `\n[${row.locale}] keys=${row.total} missing=${row.missing} identical-to-en=${row.identical}`
  );
  if (row.missingSample.length) {
    console.log('  missing sample:', row.missingSample.join(', '));
  }
}

if (failOnMissing && exitCode !== 0) {
  console.error('\nMissing translation keys detected.');
  process.exit(1);
}
