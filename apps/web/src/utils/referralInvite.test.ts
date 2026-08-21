import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildReferralShareUrl,
  isValidReferralCode,
  opaqueReferralCode,
  profileHasSupportedMode,
  profileHasTrainMode,
  shareOrCopyReferralLink,
} from './referralInvite';

describe('referralInvite', () => {
  it('does not put a Cognito-shaped user id in the opaque code or share URL', async () => {
    const userId = '11111111-2222-4333-8444-555555555555';
    const code = await opaqueReferralCode(userId);
    expect(isValidReferralCode(code)).toBe(true);
    expect(code).not.toContain(userId);
    expect(code.toLowerCase()).not.toContain('11111111');
  const url = buildReferralShareUrl(code, 'https://gettrainmate.com', { city: 'Atlanta', mode: 'TRAIN' });
    expect(url).toContain('/invite/');
    expect(url).toContain('src=referral');
    expect(url).toContain('experiment_id=EXP-003');
    expect(url).toContain('metro=Atlanta');
    expect(url).toContain('mode=TRAIN');
    expect(url).not.toContain(userId);
    expect(url).not.toContain('@');
  });

  it('omits metro when the referrer has no city', () => {
    const url = buildReferralShareUrl('abcdef0123456789', 'https://gettrainmate.com');
    expect(url).not.toContain('metro=');
  });

  it('shows the invite CTA for TRAIN, VIBE, or DATE', () => {
    expect(profileHasTrainMode({ modes: ['TRAIN'] })).toBe(true);
    expect(profileHasSupportedMode({ modes: ['TRAIN'] })).toBe(true);
    expect(profileHasSupportedMode({ modes: ['DATE', 'VIBE'] })).toBe(true);
    expect(profileHasSupportedMode({ mode: 'DATE' })).toBe(true);
    expect(profileHasSupportedMode({ mode: 'VIBE' })).toBe(true);
    expect(profileHasSupportedMode(null)).toBe(false);
    expect(profileHasTrainMode({ modes: ['DATE', 'VIBE'] })).toBe(false);
  });

  it('copies the link when native share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const result = await shareOrCopyReferralLink('https://gettrainmate.com/invite/abc');
    expect(result).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://gettrainmate.com/invite/abc');
    vi.unstubAllGlobals();
  });
});
