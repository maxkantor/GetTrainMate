import { describe, it, expect } from 'vitest';
import { formatContactability, formatContactSource } from './components';
import type { PartnerProspect } from './types';

describe('manual contact display labels', () => {
  it('labels manual_admin email as Manual contact, not Verified', () => {
    const p: PartnerProspect = {
      prospectId: 'p1',
      organizationName: 'Planet Fitness',
      email: 'manager@pf.example',
      emailSource: 'manual_admin',
      contactSourceType: 'MANUAL_ADMIN',
      emailVerificationStatus: 'manual_unverified',
      contactabilityState: 'CONTACT_FOUND',
    };
    expect(formatContactability(p)).toBe('Manual contact');
    expect(formatContactSource(p)).toBe('Manual admin entry');
  });

  it('keeps verified_public as Verified email', () => {
    const p: PartnerProspect = {
      prospectId: 'p1',
      organizationName: 'Gym',
      email: 'hello@gym.example',
      emailSource: 'public_listing',
      emailVerificationStatus: 'verified_public',
      contactabilityState: 'CONTACT_FOUND',
    };
    expect(formatContactability(p)).toBe('Verified email');
  });
});
