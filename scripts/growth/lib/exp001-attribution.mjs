/**
 * EXP-001 Stripe paid attribution from Checkout Session metadata (no PII).
 */

import { EXP001 } from './metric-definitions.mjs';

const ATTR_KEYS = [
  'acquisition_source',
  'experiment_id',
  'utm_campaign',
  'utm_source',
  'utm_medium',
  'src'
];

export function sessionHasAcquisitionMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  return ATTR_KEYS.some((k) => {
    const v = metadata[k];
    return typeof v === 'string' && v.trim().length > 0;
  });
}

export function sessionMatchesExp001(metadata) {
  if (!metadata || typeof metadata !== 'object') return false;
  const src = String(metadata.acquisition_source || metadata.src || '').toLowerCase();
  const experiment = String(metadata.experiment_id || '').toUpperCase();
  const campaign = String(metadata.utm_campaign || '').toLowerCase();
  if (experiment === 'EXP-001') return true;
  if (src === EXP001.srcParam.toLowerCase()) return true;
  if (campaign.includes('atlanta-training-partners')) return true;
  return false;
}

/**
 * @returns {{ value: number|null, available: boolean, label: string, reason: string, attributedSessions: number, sessionsWithMeta: number }}
 */
export function attributeExp001PaidConversions(livePaidSessions) {
  const sessions = Array.isArray(livePaidSessions) ? livePaidSessions : [];
  const withMeta = sessions.filter((s) => sessionHasAcquisitionMetadata(s.metadata));
  if (sessions.length > 0 && withMeta.length === 0) {
    return {
      value: null,
      available: false,
      label: 'Unknown',
      reason:
        'No reliable Stripe metadata / UTM link from EXP-001 sessions to live payments. Existing payments lack acquisition metadata.',
      attributedSessions: 0,
      sessionsWithMeta: 0
    };
  }
  const attributed = withMeta.filter((s) => sessionMatchesExp001(s.metadata));
  return {
    value: attributed.length,
    available: true,
    label: String(attributed.length),
    reason:
      attributed.length === 0
        ? 'Live payments present with acquisition metadata, but none match EXP-001 (src/experiment_id/utm_campaign).'
        : 'Counted live paid Checkout Sessions whose metadata matches EXP-001.',
    attributedSessions: attributed.length,
    sessionsWithMeta: withMeta.length
  };
}
