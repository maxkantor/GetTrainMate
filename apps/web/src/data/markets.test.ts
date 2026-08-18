import { describe, expect, it } from 'vitest';
import {
  canActivateAnotherMarket,
  canonicalAtlantaInvitePath,
  isApprovedOutreachLanguage,
  MAX_ACTIVE_MARKETS,
  partnerInvitePath,
  partnerSignupPath,
  recommendedAllocations,
  rankMarkets,
  utmCampaignId,
} from './markets';

describe('markets', () => {
  it('builds international partner paths and UTMs', () => {
    expect(partnerInvitePath('US', 'Atlanta', 'atl-track-club')).toBe(
      '/partners/us/atlanta/atl-track-club'
    );
    expect(canonicalAtlantaInvitePath('atl-track-club')).toBe(
      '/partners/us/atlanta/atl-track-club'
    );
    expect(utmCampaignId('us', 'new-york', 'TRAIN')).toBe('us_new-york_train_partners');
    const signup = partnerSignupPath({
      country: 'us',
      market: 'atlanta',
      inviteCode: 'atl-f3',
      orgType: 'run_club',
    });
    expect(signup).toContain('utm_source=partner_outreach');
    expect(signup).toContain('utm_campaign=us_atlanta_train_partners');
    expect(signup).toContain('utm_content=run-club');
    expect(signup).toContain('experiment_id=EXP-002');
  });

  it('supports en, es, ru approved outreach templates', () => {
    expect(isApprovedOutreachLanguage('en')).toBe(true);
    expect(isApprovedOutreachLanguage('es')).toBe(true);
    expect(isApprovedOutreachLanguage('ru')).toBe(true);
    expect(isApprovedOutreachLanguage('fr')).toBe(false);
  });

  it('caps active markets and ranks by verified evidence without guessing zeros as density', () => {
    expect(MAX_ACTIVE_MARKETS).toBe(3);
    expect(canActivateAnotherMarket(3)).toBe(false);
    expect(canActivateAnotherMarket(2)).toBe(true);
    expect(recommendedAllocations(['a', 'b', 'c'])).toEqual({ a: 50, b: 30, c: 20 });
    const ranked = rankMarkets([
      { campaignId: 'a', completedProfiles: 1, matches: 0 },
      { campaignId: 'b', completedProfiles: 0, matches: 2 },
      { campaignId: 'c' },
    ]);
    expect(ranked[0].campaignId).toBe('b');
    expect(ranked[2].campaignId).toBe('c');
  });
});
