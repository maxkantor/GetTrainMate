/** ISO 3166-1 alpha-2 (or flagcdn regional) codes for World Cup teams — synced with official catalog. */
const TEAM_ISO: Record<string, string> = {
  mexico: 'mx',
  'south-africa': 'za',
  'south-korea': 'kr',
  czechia: 'cz',
  canada: 'ca',
  'bosnia-herzegovina': 'ba',
  qatar: 'qa',
  switzerland: 'ch',
  brazil: 'br',
  morocco: 'ma',
  haiti: 'ht',
  scotland: 'gb-sct',
  usa: 'us',
  paraguay: 'py',
  australia: 'au',
  turkiye: 'tr',
  germany: 'de',
  curacao: 'cw',
  'ivory-coast': 'ci',
  ecuador: 'ec',
  netherlands: 'nl',
  japan: 'jp',
  sweden: 'se',
  tunisia: 'tn',
  belgium: 'be',
  egypt: 'eg',
  iran: 'ir',
  'new-zealand': 'nz',
  spain: 'es',
  'cape-verde': 'cv',
  'saudi-arabia': 'sa',
  uruguay: 'uy',
  france: 'fr',
  senegal: 'sn',
  norway: 'no',
  iraq: 'iq',
  argentina: 'ar',
  algeria: 'dz',
  austria: 'at',
  jordan: 'jo',
  portugal: 'pt',
  colombia: 'co',
  'dr-congo': 'cd',
  uzbekistan: 'uz',
  england: 'gb-eng',
  croatia: 'hr',
  ghana: 'gh',
  panama: 'pa',
};

export function teamIdToIso(teamId?: string | null): string | null {
  if (!teamId?.trim()) return null;
  return TEAM_ISO[teamId.trim().toLowerCase()] ?? null;
}

/** flagcdn.com width token for crisp display at common UI sizes. */
export function flagCdnUrl(teamId?: string | null, displayPx = 32): string | null {
  const iso = teamIdToIso(teamId);
  if (!iso) return null;
  const w = displayPx <= 24 ? 40 : displayPx <= 40 ? 80 : 160;
  return `https://flagcdn.com/w${w}/${iso}.png`;
}

/** Load a team flag image for canvas export (flagcdn allows cross-origin). */
export function loadFlagImage(teamId?: string | null, displayPx = 40): Promise<HTMLImageElement | null> {
  const url = flagCdnUrl(teamId, displayPx);
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadFlagImageMap(
  teamIds: string[],
  displayPx = 40,
): Promise<Map<string, HTMLImageElement>> {
  const map = new Map<string, HTMLImageElement>();
  const unique = [...new Set(teamIds.map((id) => id.trim().toLowerCase()).filter(Boolean))];
  await Promise.all(unique.map(async (id) => {
    const img = await loadFlagImage(id, displayPx);
    if (img) map.set(id, img);
  }));
  return map;
}
