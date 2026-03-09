/**
 * IP-based geolocation. Tries ip-api.com first, falls back to ipwho.is on 403/rate limit.
 * No API keys; both have free non-commercial tiers.
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

const IP_API_URL = 'https://ip-api.com/json/?fields=status,city,regionName,country,lat,lon';
const IPWHO_URL = 'https://ipwho.is/';

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
  try {
    const res = await fetch(IP_API_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        const loc = toLocation(data);
        if (loc) {
          cached = loc;
          return loc;
        }
      }
    }
  } catch {
    /* fall through to backup */
  }
  try {
    const res = await fetch(IPWHO_URL, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      if (data.success !== false && (data.city ?? data.country)) {
        const loc = toLocation({
          city: data.city,
          region: data.region,
          country: data.country,
          latitude: data.latitude,
          longitude: data.longitude,
        });
        if (loc) {
          cached = loc;
          return loc;
        }
      }
    }
  } catch {
    /* both failed */
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
