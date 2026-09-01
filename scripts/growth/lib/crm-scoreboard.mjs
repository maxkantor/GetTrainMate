/**
 * Merge CRM marketplace truth into scoreboard when GA4 cells are unavailable.
 * Never overwrites a successful GA4 query with CRM — only fills gaps.
 */
export function crmModeTotals(marketplaceDensity) {
  const t = marketplaceDensity?.modeTotals || marketplaceDensity?.ModeTotals || {};
  return {
    TRAIN: t.train ?? t.Train ?? t.TRAIN ?? null,
    VIBE: t.vibe ?? t.Vibe ?? t.VIBE ?? null,
    DATE: t.date ?? t.Date ?? t.DATE ?? null
  };
}

export function crmCompletedProfilesTotal(modes) {
  const vals = [modes.TRAIN, modes.VIBE, modes.DATE].filter((v) => typeof v === 'number');
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0);
}

export function crmMetroTotals(marketplaceDensity) {
  const metros = marketplaceDensity?.metros || marketplaceDensity?.byMetro || [];
  let requests = 0;
  let matches = 0;
  let completed = 0;
  for (const row of metros) {
    requests += row.connectionsSent ?? row.ConnectionsSent ?? 0;
    matches += row.matchesCreated ?? row.MatchesCreated ?? 0;
    completed += row.completedProfiles ?? row.CompletedProfiles ?? 0;
  }
  return { requests, matches, completedProfiles: completed };
}

/**
 * @param {object} scoreboardRow
 * @param {{ ga4Ok: boolean, marketplaceDensity?: object }} ctx
 */
export function overlayCrmOnScoreboard(scoreboardRow, { ga4Ok, marketplaceDensity }) {
  if (!scoreboardRow || ga4Ok) return scoreboardRow;
  const out = { ...scoreboardRow };
  const modes = crmModeTotals(marketplaceDensity);
  const metro = crmMetroTotals(marketplaceDensity);
  const crmCell = (value, unit, label) => ({
    value,
    unit,
    label,
    available: value != null,
    method: 'crm_fallback',
    source: 'admin_crm'
  });

  if (!out.completed_profiles?.available && modes.TRAIN != null) {
    out.completed_profiles = crmCell(
      crmCompletedProfilesTotal(modes),
      'profiles',
      'CRM completed (mode sum; users may select multiple modes)'
    );
  }
  if (!out.connections_sent?.available && metro.requests > 0) {
    out.connections_sent = crmCell(metro.requests, 'events', 'CRM connection likes sent');
  }
  if (!out.matches_created?.available && metro.matches > 0) {
    out.matches_created = crmCell(metro.matches, 'events', 'CRM mutual matches');
  }
  out._crmModes = modes;
  out._crmMetro = metro;
  return out;
}

export function parseGa4Overview(report) {
  const row = report?.rows?.[0];
  if (!row?.metricValues?.length) return null;
  const [sessions, totalUsers, newUsers, activeUsers] = row.metricValues.map((m) =>
    Number(m?.value ?? 0)
  );
  return {
    sessions,
    totalUsers,
    newUsers,
    activeUsers: activeUsers ?? null,
    available: true
  };
}

export function parseGa4Campaigns(report) {
  const rows = [];
  for (const row of report?.rows ?? []) {
    const campaign = row.dimensionValues?.[0]?.value ?? '(not set)';
    const sessions = Number(row.metricValues?.[0]?.value ?? 0);
    const users = Number(row.metricValues?.[1]?.value ?? 0);
    const newUsers = Number(row.metricValues?.[2]?.value ?? 0);
    rows.push({ campaign, sessions, users, newUsers });
  }
  return rows;
}

export function classifyCampaignOutcome(row) {
  if (!row?.sessions) return 'PUBLISHED_NO_TRAFFIC';
  if (row.sessions > 0 && !row.newUsers && !row.signupStarts) return 'TRAFFIC_NO_ACTIVATION';
  return 'MEASURING';
}
