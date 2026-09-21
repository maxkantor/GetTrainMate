#!/usr/bin/env node
/**
 * Run automated international partner discovery via async jobs (no send).
 * Prefer this over long-held sync discover/automated.
 *
 *   node scripts/growth/run-market-discovery.mjs
 *   DISCOVERY_SEEDS_ONLY=true node scripts/growth/run-market-discovery.mjs
 */
import {
  adminCrmToken,
  runLimitedPartnerDiscovery,
} from './lib/partner-outreach-crm.mjs';

async function main() {
  const token = await adminCrmToken();
  if (!token) {
    console.error('Set GROWTH_CRM_ADMIN_TOKEN or GROWTH_CRM_ADMIN_EMAIL + GROWTH_CRM_ADMIN_PASSWORD');
    process.exit(1);
  }
  const seedsOnly = process.env.DISCOVERY_SEEDS_ONLY === 'true';
  const onlyCampaignId = process.env.DISCOVERY_CAMPAIGN_ID?.trim() || undefined;
  const maxProspects = Number(process.env.DISCOVERY_MAX_PROSPECTS || 8) || 8;
  const maxResearchAttempts = Number(process.env.DISCOVERY_MAX_RESEARCH || 15) || 15;
  const maxDrafts = Number(process.env.DISCOVERY_MAX_DRAFTS || 5) || 5;

  const report = await runLimitedPartnerDiscovery({
    prepareDrafts: true,
    seedsOnly,
    onlyCampaignId,
    maxProspects,
    maxResearchAttempts,
    maxDrafts,
  });
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok && report.status !== 'partial') process.exit(1);
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
