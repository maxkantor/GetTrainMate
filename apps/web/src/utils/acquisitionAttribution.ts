/**
 * Client-side acquisition attribution (EXP-001 and future).
 * Stores only non-PII campaign params in sessionStorage and forwards them to Stripe metadata.
 * Never store email, name, phone, or precise coordinates.
 */

const STORAGE_KEY = 'gtm_acquisition_attribution_v1';

const ALLOWED_KEYS = [
  'src',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'metro',
  'mode',
  'experiment_id',
  'partner',
] as const;

export type AcquisitionAttribution = Partial<Record<(typeof ALLOWED_KEYS)[number], string>>;

function sanitizeValue(raw: string | null | undefined, max = 64): string | undefined {
  if (raw == null) return undefined;
  const cleaned = String(raw)
    .trim()
    .slice(0, max)
    .replace(/[^\w.\-:%]/g, '');
  return cleaned || undefined;
}

/** Capture allowed query params from a URLSearchParams or location.search string. */
export function captureAcquisitionFromSearch(search: string | URLSearchParams): AcquisitionAttribution {
  const params = typeof search === 'string' ? new URLSearchParams(search.startsWith('?') ? search : `?${search}`) : search;
  const next: AcquisitionAttribution = {};
  for (const key of ALLOWED_KEYS) {
    const v = sanitizeValue(params.get(key));
    if (v) next[key] = v;
  }
  // Landing path without src still marks EXP-001 when linked from Atlanta page CTAs.
  if (params.get('src') === 'atlanta-training-partners' && !next.experiment_id) {
    next.experiment_id = 'EXP-001';
  }
  if ((params.get('src') === 'partner' || params.get('partner')) && !next.experiment_id) {
    next.experiment_id = 'EXP-002';
  }
  return next;
}

export function mergeAndPersistAcquisition(partial: AcquisitionAttribution): AcquisitionAttribution {
  const prev = readAcquisitionAttribution();
  const merged: AcquisitionAttribution = { ...prev };
  for (const key of ALLOWED_KEYS) {
    const v = sanitizeValue(partial[key]);
    if (v) merged[key] = v;
  }
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
  return merged;
}

export function readAcquisitionAttribution(): AcquisitionAttribution {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: AcquisitionAttribution = {};
    for (const key of ALLOWED_KEYS) {
      const v = sanitizeValue(typeof parsed[key] === 'string' ? parsed[key] : undefined);
      if (v) out[key] = v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Mark Atlanta landing visits for later checkout attribution. */
export function markAtlantaLandingVisit(): AcquisitionAttribution {
  return mergeAndPersistAcquisition({
    src: 'atlanta-training-partners',
    metro: 'Atlanta',
    mode: 'TRAIN',
    experiment_id: 'EXP-001',
    utm_campaign: 'atlanta-training-partners',
  });
}

/** Payload safe to send to checkout API / Stripe metadata (string values only). */
export function attributionForCheckout(): Record<string, string> {
  const a = readAcquisitionAttribution();
  const out: Record<string, string> = {};
  if (a.src) out.acquisition_source = a.src;
  if (a.experiment_id) out.experiment_id = a.experiment_id;
  if (a.metro) out.metro = a.metro;
  if (a.mode) out.mode = a.mode;
  if (a.utm_source) out.utm_source = a.utm_source;
  if (a.utm_medium) out.utm_medium = a.utm_medium;
  if (a.utm_campaign) out.utm_campaign = a.utm_campaign;
  if (a.utm_content) out.utm_content = a.utm_content;
  if (a.utm_term) out.utm_term = a.utm_term;
  if (a.partner) out.partner_code = a.partner;
  return out;
}
