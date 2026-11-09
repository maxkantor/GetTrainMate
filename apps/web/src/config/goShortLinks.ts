/**
 * Owned-social short links: /go/:code → marketing destination.
 * Keep Amplify 301 rules in amplify.yml / deploy/amplify-custom-rules.json in sync.
 */
export const GO_CODE_LANDINGS: Record<string, string> = {
  t: '/workout-partner',
  train: '/workout-partner',
  v: '/meet-people',
  vibe: '/meet-people',
  d: '/active-dating',
  date: '/active-dating',
  sf: '/san-francisco',
  signup: '/signup',
  ig: '/go',
  fb: '/go',
};

/** Resolve a short code to a path. Unknown codes fall back to the /go hub. */
export function landingPathForGoCode(rawCode: string | undefined | null): string {
  const code = String(rawCode || '')
    .trim()
    .toLowerCase();
  if (!code) return '/go';
  return GO_CODE_LANDINGS[code] || '/go';
}
