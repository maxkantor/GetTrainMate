#!/usr/bin/env node
/** Production health smoke for GetTrainMate growth deploys. Exit 1 if critical checks fail. */
const SITE = 'https://gettrainmate.com';
const API_BASE =
  process.env.VITE_API_URL?.replace(/\/$/, '') ||
  'https://goskwzjzjg.execute-api.us-east-1.amazonaws.com';

const checks = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
  } catch (e) {
    checks.push({ name, ok: false, detail: e instanceof Error ? e.message : String(e) });
  }
}

await check('api_health', async () => {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return await res.json();
});

await check('homepage', async () => {
  const res = await fetch(`${SITE}/`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!/GetTrainMate|TrainMate|gettrainmate/i.test(html)) throw new Error('brand missing from HTML');
  if (/noindex/i.test(html) && !/index,\s*follow/i.test(html)) throw new Error('unexpected noindex on homepage');
  return { bytes: html.length };
});

await check('pricing_prerender', async () => {
  const res = await fetch(`${SITE}/pricing`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const html = await res.text();
  if (!/gettrainmate\.com\/pricing/i.test(html)) {
    throw new Error('pricing canonical/shell missing — prerender or Amplify rewrite may be broken');
  }
  return { bytes: html.length, hasPricingCanonical: /gettrainmate\.com\/pricing/i.test(html) };
});

await check('robots', async () => {
  const res = await fetch(`${SITE}/robots.txt`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  const txt = await res.text();
  if (!/Sitemap:\s*https:\/\/gettrainmate\.com\/sitemap\.xml/i.test(txt)) {
    throw new Error('sitemap line missing');
  }
  return { bytes: txt.length };
});

await check('signup_route', async () => {
  const res = await fetch(`${SITE}/signup`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return { status: res.status };
});

await check('app_shell', async () => {
  const res = await fetch(`${SITE}/app`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return { status: res.status };
});

const failed = checks.filter((c) => !c.ok);
console.log(JSON.stringify({ ok: failed.length === 0, site: SITE, api: API_BASE, checks }, null, 2));
process.exit(failed.length ? 1 : 0);
