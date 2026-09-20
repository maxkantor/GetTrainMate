#!/usr/bin/env -S npx tsx
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCALES_DIR = path.join(__dirname, '../apps/web/src/i18n/locales');

function leafKeys(obj, prefix = '') {
  const out = new Map();
  for (const [k, v] of Object.entries(obj ?? {})) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === 'object' && !Array.isArray(v)) {
      for (const [ck, cv] of leafKeys(v, p)) out.set(ck, cv);
    } else out.set(p, v);
  }
  return out;
}

async function loadLocale(code) {
  const mod = await import(pathToFileURL(path.join(LOCALES_DIR, `${code}.ts`)).href);
  return mod[code];
}

const en = await loadLocale('en');
const enKeys = leafKeys(en);
const out = {};

for (const code of ['es', 'ru', 'ua', 'hi', 'zh', 'fr', 'de']) {
  const loc = leafKeys(await loadLocale(code));
  out[code] = [...enKeys.keys()].filter((k) => !loc.has(k));
}

const outPath = path.join(__dirname, '../.cursor/i18n-missing-keys.json');
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('Wrote', outPath);
for (const [code, keys] of Object.entries(out)) {
  console.log(`${code}: ${keys.length} missing`);
}
