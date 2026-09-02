/**
 * Structured logging for social image generation (never logs secrets).
 */
export function logSocialImageEvent(event, meta = {}) {
  const safe = { event, ts: new Date().toISOString(), ...meta };
  delete safe.pageToken;
  delete safe.access_token;
  delete safe.token;
  console.error(JSON.stringify(safe));
}
