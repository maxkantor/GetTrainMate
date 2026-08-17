import { SITE_ORIGIN } from '@/config/site';

export const REFERRAL_EXPERIMENT_ID = 'EXP-003';
export const REFERRAL_SRC = 'referral';
export const REFERRAL_SHARE_TITLE = 'Find a training partner in Atlanta';
export const REFERRAL_SHARE_TEXT =
  'GetTrainMate is TRAIN-first (not dating-first). Create a profile and find people who want to run, lift, or race with you.';

export function profileHasTrainMode(profile?: { mode?: string; modes?: string[] } | null): boolean {
  const modes = profile?.modes?.length ? profile.modes : profile?.mode ? [profile.mode] : [];
  return modes.some((m) => String(m).toUpperCase() === 'TRAIN');
}

export function isValidReferralCode(code: string | undefined | null): boolean {
  return /^[a-f0-9]{16}$/i.test(String(code || '').trim());
}

/** Opaque 16-hex code. Does not include email, Cognito id, or profile fields in the URL. */
export async function opaqueReferralCode(userId: string): Promise<string> {
  const id = String(userId || '').trim();
  if (!id) throw new Error('userId required');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`gtm-ref-v1:${id}`));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return hex.slice(0, 16);
}

export function buildReferralSignupPath(code: string): string {
  const q = new URLSearchParams({
    metro: 'Atlanta',
    mode: 'TRAIN',
    src: REFERRAL_SRC,
    experiment_id: REFERRAL_EXPERIMENT_ID,
    ref: code,
  });
  return `/signup?${q.toString()}`;
}

export function buildReferralShareUrl(code: string, origin = SITE_ORIGIN): string {
  const q = new URLSearchParams({
    metro: 'Atlanta',
    mode: 'TRAIN',
    src: REFERRAL_SRC,
    experiment_id: REFERRAL_EXPERIMENT_ID,
    ref: code,
  });
  return `${origin.replace(/\/$/, '')}/invite/${encodeURIComponent(code)}?${q.toString()}`;
}

export type InviteShareResult = 'shared' | 'copied' | 'aborted' | 'failed';

export async function shareOrCopyReferralLink(url: string): Promise<InviteShareResult> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: REFERRAL_SHARE_TITLE,
        text: `${REFERRAL_SHARE_TEXT}\n${url}`,
        url,
      });
      return 'shared';
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'aborted';
    }
  }
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return 'copied';
    }
  } catch {
    /* fall through */
  }
  return 'failed';
}
