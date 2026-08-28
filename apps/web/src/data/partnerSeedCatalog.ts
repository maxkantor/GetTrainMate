/** Seed orgs for partner discovery — mirrors MarketCampaignCatalog.AtlantaTrainOrgWebsites (API). */
export type PartnerSeedEntry = {
  partnerCode: string;
  organizationName: string;
  website: string;
};

export const PARTNER_SEED_CATALOG: Record<string, PartnerSeedEntry[]> = {
  us_atlanta_train_partners: [
    { partnerCode: 'atl-track-club', organizationName: 'Atlanta Track Club', website: 'https://www.atlantatrackclub.org/' },
    { partnerCode: 'atl-fleet-feet', organizationName: 'Fleet Feet Atlanta', website: 'https://www.fleetfeet.com/s/atlanta' },
    { partnerCode: 'atl-f3', organizationName: 'F3 Atlanta', website: 'https://f3atlanta.com/' },
    { partnerCode: 'atl-pickleball', organizationName: 'Atlanta Pickleball Club', website: 'https://atlantapickleballclub.com/' },
    { partnerCode: 'atl-hyrox-crossfit', organizationName: 'Elite Edge HYROX Atlanta', website: 'https://eliteedgeatl.com/hyrox-training-club-atlanta/' },
    { partnerCode: 'atl-tri-club', organizationName: 'Atlanta Triathlon Club', website: 'https://atlantatriclub.com/' },
    { partnerCode: 'atl-midtown-trainers', organizationName: 'Midtown Trainers', website: 'https://midtowntrainers.com/' },
    { partnerCode: 'atl-softball-rec', organizationName: 'JAM Sports Atlanta', website: 'https://jamsports.com/discover/atlanta' },
    { partnerCode: 'atl-outdoor-club', organizationName: 'Atlanta Outdoor Club', website: 'https://www.atlantaoutdoorclub.com/' },
  ],
};

export function localPartnerSeeds(campaignId: string): PartnerSeedEntry[] {
  return PARTNER_SEED_CATALOG[campaignId] ?? [];
}
