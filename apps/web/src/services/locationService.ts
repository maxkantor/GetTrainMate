/**
 * IP-based geolocation. Tries multiple providers (ip-api, ipwho, reallyfreegeoip, geoiplookup).
 * No API keys; all have free tiers. Falls through on 403/rate limit.
 */

export interface IpLocation {
  city: string;
  regionName: string;
  country: string;
  lat: number;
  lon: number;
  /** Approximate label e.g. "San Francisco, CA" */
  label: string;
}

const PROVIDERS: Array<{
  url: string;
  parse: (data: Record<string, unknown>) => IpLocation | null;
}> = [
  {
    url: 'https://ip-api.com/json/?fields=status,city,regionName,country,lat,lon',
    parse: (d) => (d.status === 'success' && d.city != null ? toLocation({ city: String(d.city ?? ''), regionName: d.regionName as string | undefined, country: d.country as string | undefined, lat: d.lat as number | undefined, lon: d.lon as number | undefined }) : null),
  },
  {
    url: 'https://ipwho.is/',
    parse: (d) => (d.success !== false && (d.city ?? d.country) ? toLocation({ city: d.city as string | undefined, region: d.region as string | undefined, country: d.country as string | undefined, latitude: d.latitude as number | undefined, longitude: d.longitude as number | undefined }) : null),
  },
  {
    url: 'https://reallyfreegeoip.org/json/',
    parse: (d) => (d.country_name ? toLocation({ city: d.city as string | undefined, regionName: d.region_name as string | undefined, country: String(d.country_name ?? ''), lat: d.latitude as number | undefined, lon: d.longitude as number | undefined }) : null),
  },
  {
    url: 'https://json.geoiplookup.io/',
    parse: (d) => (d.success !== false && d.country_name ? toLocation({ city: d.city as string | undefined, region: d.region as string | undefined, country: String(d.country_name ?? ''), latitude: d.latitude as number | undefined, longitude: d.longitude as number | undefined }) : null),
  },
];

let cached: IpLocation | null = null;

function toLocation(data: {
  city?: string;
  regionName?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  latitude?: number;
  longitude?: number;
}): IpLocation | null {
  const city = data.city ?? '';
  const regionName = data.regionName ?? data.region ?? '';
  const country = data.country ?? '';
  const lat = Number(data.lat ?? data.latitude) || 0;
  const lon = Number(data.lon ?? data.longitude) || 0;
  if (!city && !country) return null;
  return {
    city,
    regionName,
    country,
    lat,
    lon,
    label: [city, regionName].filter(Boolean).join(', ') || country || 'Unknown',
  };
}

export async function getLocationFromIp(): Promise<IpLocation | null> {
  if (cached) return cached;
  // Third-party IP APIs (ip-api, ipwho, etc.) often return 403 or omit CORS from real production
  // origins — browser fetch fails every time and spams the console. Discover already uses
  // FALLBACK_LOCATION when this returns null; no need to hammer these URLs in production.
  if (typeof import.meta !== 'undefined' && import.meta.env?.PROD) {
    return null;
  }
  for (const { url, parse } of PROVIDERS) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        const data = (await res.json()) as Record<string, unknown>;
        const loc = parse(data);
        if (loc) {
          cached = loc;
          return loc;
        }
      }
    } catch {
      /* try next provider */
    }
  }
  return null;
}

export function clearLocationCache(): void {
  cached = null;
}

/** Fallback when IP geolocation fails (e.g. 403, rate limit). Use so "near you" profiles still show. */
export const FALLBACK_LOCATION: IpLocation = {
  city: 'Near you',
  regionName: '',
  country: '',
  lat: 0,
  lon: 0,
  label: 'Near you',
};
