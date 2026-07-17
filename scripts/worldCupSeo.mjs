/**
 * Build-time switch for World Cup public SEO (sitemap + prerender shells).
 * Default: ON. Set Amplify env WORLD_CUP_SEO=false when retiring the hub.
 * Product visibility (nav/hub) is separate — Admin feature flags / EventConfig.enabled.
 */
export function isWorldCupSeoEnabled(env = process.env) {
  const raw = (env.WORLD_CUP_SEO ?? env.VITE_WORLD_CUP_SEO ?? 'true').trim().toLowerCase();
  return !(raw === '0' || raw === 'false' || raw === 'off' || raw === 'no');
}
