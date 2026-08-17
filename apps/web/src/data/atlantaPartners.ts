/**
 * Atlanta TRAIN partner registry (EXP-002).
 * Partner codes are public invite tokens — never store PII here.
 * Canonical public path is /partners/us/atlanta/:code. Legacy /partners/atlanta/:code redirects.
 * Add prospects only after a verified public email; do not fabricate community size.
 */
import {
  partnerInvitePath,
  partnerSignupPath as marketSignupPath,
} from '@/data/markets';

export type AtlantaPartnerCommunityType =
  | 'run_club'
  | 'gym_crossfit_hyrox'
  | 'pickleball'
  | 'trainer'
  | 'rec_sports'
  | 'outdoor_club';

export type AtlantaPartnerRecord = {
  /** Public invite code: atl-{slug} */
  code: string;
  /** Display name shown on the partner landing (organization or placeholder label). */
  displayName: string;
  communityType: AtlantaPartnerCommunityType;
  /** Short public-facing blurb — no density claims. */
  blurb: string;
  /** Optional public website (empty until confirmed). */
  publicUrl?: string;
  /** Whether this code is ready for distribution (outreach may still be pending). */
  status: 'template' | 'ready' | 'paused';
};

/** Canonical partner codes used for attribution (`partner` query + Stripe metadata). */
export const ATLANTA_PARTNERS: AtlantaPartnerRecord[] = [
  {
    code: 'atl-track-club',
    displayName: 'Atlanta Track Club community',
    communityType: 'run_club',
    blurb: 'For runners who want a consistent training partner in Atlanta — TRAIN mode first.',
    publicUrl: 'https://www.atlantatrackclub.org/',
    status: 'ready',
  },
  {
    code: 'atl-fleet-feet',
    displayName: 'Fleet Feet Atlanta community',
    communityType: 'run_club',
    blurb: 'Connect with people who train for races and weekly miles around Atlanta.',
    publicUrl: 'https://www.fleetfeet.com/s/atlanta',
    status: 'ready',
  },
  {
    code: 'atl-f3',
    displayName: 'F3 Atlanta community',
    communityType: 'outdoor_club',
    blurb: 'Find workout partners who show up — free workouts, TRAIN intent on GetTrainMate.',
    publicUrl: 'https://f3atlanta.com/',
    status: 'ready',
  },
  {
    code: 'atl-pickleball',
    displayName: 'Atlanta pickleball community',
    communityType: 'pickleball',
    blurb: 'Meet players looking for regular games and training partners in Atlanta.',
    publicUrl: 'https://atlantapickleballclub.com/',
    status: 'ready',
  },
  {
    code: 'atl-hyrox-crossfit',
    displayName: 'Atlanta Hyrox / CrossFit community',
    communityType: 'gym_crossfit_hyrox',
    blurb: 'Partner up for Hyrox prep, CrossFit sessions, and strength work in Atlanta.',
    publicUrl: 'https://eliteedgeatl.com/hyrox-training-club-atlanta/',
    status: 'ready',
  },
  {
    code: 'atl-tri-club',
    displayName: 'Atlanta triathlon community',
    communityType: 'rec_sports',
    blurb: 'Swim, bike, and run with locals who want accountable training partners.',
    publicUrl: 'https://atlantatriclub.com/',
    status: 'ready',
  },
  {
    code: 'atl-midtown-trainers',
    displayName: 'Midtown Atlanta trainers',
    communityType: 'trainer',
    blurb: 'Trainers and clients looking for compatible training partners nearby.',
    publicUrl: 'https://midtowntrainers.com/',
    status: 'ready',
  },
  {
    code: 'atl-softball-rec',
    displayName: 'Atlanta recreational sports',
    communityType: 'rec_sports',
    blurb: 'Rec leagues and casual athletes who want more consistent training buddies.',
    publicUrl: 'https://jamsports.com/discover/atlanta',
    status: 'ready',
  },
  {
    code: 'atl-outdoor-club',
    displayName: 'Atlanta outdoor fitness',
    communityType: 'outdoor_club',
    blurb: 'Trail, park, and outdoor training partners across metro Atlanta.',
    publicUrl: 'https://www.atlantaoutdoorclub.com/',
    status: 'ready',
  },
  {
    code: 'atl-generic-train',
    displayName: 'Atlanta TRAIN partners',
    communityType: 'gym_crossfit_hyrox',
    blurb: 'A shared invite for Atlanta TRAIN communities — set your city and start Discover.',
    status: 'template',
  },
];

const byCode = new Map(ATLANTA_PARTNERS.map((p) => [p.code.toLowerCase(), p]));

export function normalizePartnerCode(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const cleaned = String(raw)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '')
    .slice(0, 48);
  if (!cleaned.startsWith('atl-')) return null;
  return cleaned;
}

export function getAtlantaPartner(code: string | undefined | null): AtlantaPartnerRecord | null {
  const n = normalizePartnerCode(code);
  if (!n) return null;
  return byCode.get(n) ?? null;
}

/** Fallback copy when code is valid-shaped but not in the registry. */
export function resolveAtlantaPartnerLanding(code: string | undefined | null): {
  partner: AtlantaPartnerRecord;
  known: boolean;
} {
  const known = getAtlantaPartner(code);
  if (known) return { partner: known, known: true };
  const n = normalizePartnerCode(code) || 'atl-generic-train';
  return {
    known: false,
    partner: {
      code: n,
      displayName: 'Atlanta TRAIN community',
      communityType: 'gym_crossfit_hyrox',
      blurb: 'Join GetTrainMate in TRAIN mode, set Atlanta as your city, and find local training partners.',
      status: 'template',
    },
  };
}

export function partnerSignupPath(partnerCode: string): string {
  const code = normalizePartnerCode(partnerCode) || 'atl-generic-train';
  return marketSignupPath({
    country: 'us',
    market: 'atlanta',
    mode: 'TRAIN',
    inviteCode: code,
    experimentId: 'EXP-002',
  });
}

export function partnerLandingPath(partnerCode: string): string {
  const code = normalizePartnerCode(partnerCode) || 'atl-generic-train';
  return partnerInvitePath('us', 'atlanta', code);
}
