import { describe, it, expect } from 'vitest';
import { captureAcquisitionFromSearch } from './acquisitionAttribution';

describe('acquisitionAttribution referral', () => {
  it('maps referral src to EXP-003 and does not set partner', () => {
    const a = captureAcquisitionFromSearch(
      '?metro=Atlanta&mode=TRAIN&src=referral&experiment_id=EXP-003&ref=abcdef0123456789'
    );
    expect(a.src).toBe('referral');
    expect(a.experiment_id).toBe('EXP-003');
    expect(a.ref).toBe('abcdef0123456789');
    expect(a.partner).toBeUndefined();
    expect(a.metro).toBe('Atlanta');
    expect(a.mode).toBe('TRAIN');
  });

  it('does not assign EXP-002 to non-Atlanta partner landings', () => {
    const a = captureAcquisitionFromSearch(
      '?metro=miami&country=us&mode=TRAIN&src=partner&partner=example-club&utm_campaign=us_miami_train_partners'
    );
    expect(a.experiment_id).toBeUndefined();
    expect(a.metro).toBe('miami');
  });
});
