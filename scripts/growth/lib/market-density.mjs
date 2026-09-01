/**
 * Rank country/metro/mode pockets from CRM evidence. Missing metrics stay missing — never guessed.
 */
export function scorePocket(row) {
  return (
    (row.completedProfiles ?? 0) * 8 +
    (row.discoverUsers ?? 0) * 6 +
    (row.connections ?? row.connectionsSent ?? 0) * 5 +
    (row.matches ?? row.matchesCreated ?? 0) * 50 +
    (row.firstMessages ?? 0) * 20 +
    (row.returningUsers ?? 0) * 4 +
    (row.paidUsers ?? 0) * 40
  );
}

export function rankPockets(rows) {
  return [...(rows || [])].sort((a, b) => scorePocket(b) - scorePocket(a));
}

export function pocketsFromMetroCrm(md) {
  if (Array.isArray(md?.pockets) && md.pockets.length) {
    return rankPockets(
      md.pockets.map((p) => ({
        country: p.country || p.Country || '',
        metro: p.metro || p.Metro || '',
        mode: p.mode || p.Mode || '',
        language: p.language || p.Language || 'unknown',
        completedProfiles: p.completedProfiles ?? p.CompletedProfiles ?? 0,
        connections: p.connectionsSent ?? p.ConnectionsSent ?? 0,
        matches: p.matchesCreated ?? p.MatchesCreated ?? 0,
        discoverUsers: p.discoverUsers ?? p.DiscoverUsers ?? null,
        returningUsers: p.returningUsers ?? p.ReturningUsers ?? null,
        paidUsers: p.paidUsers ?? p.PaidUsers ?? null
      }))
    );
  }
  const metros = Array.isArray(md?.metros) ? md.metros : [];
  return rankPockets(
    metros.map((row) => ({
      country: row.country || '',
      metro: row.metro || row.Metro || 'Unknown',
      mode: '',
      language: '',
      completedProfiles: row.completedProfiles ?? row.CompletedProfiles ?? 0,
      connections: row.connectionsSent ?? row.ConnectionsSent ?? 0,
      matches: row.matchesCreated ?? row.MatchesCreated ?? 0,
      discoverUsers: row.discoverUsers ?? row.DiscoverUsers ?? null,
      returningUsers: row.returningUsers ?? row.ReturningUsers ?? null
    }))
  );
}

export function modeTotalsFromMetro(md) {
  const t = md?.modeTotals || md?.ModeTotals || {};
  return {
    TRAIN: t.train ?? t.Train ?? t.TRAIN ?? null,
    VIBE: t.vibe ?? t.Vibe ?? t.VIBE ?? null,
    DATE: t.date ?? t.Date ?? t.DATE ?? null
  };
}
