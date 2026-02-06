/**
 * IP-based geolocation. Uses ip-api.com (no API key, 45 req/min for non-commercial).
 * Use for "near you" dummy profiles and location-aware discover.
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

let cached: IpLocation | null = null;

export async function getLocationFromIp(): Promise<IpLocation | null> {
  if (cached) return cached;
  try {
    const res = await fetch(IP_API_URL, { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data.status !== 'success' || data.city == null) return null;
    const location: IpLocation = {
      city: data.city ?? '',
      regionName: data.regionName ?? '',
      country: data.country ?? '',
      lat: Number(data.lat) || 0,
      lon: Number(data.lon) || 0,
      label: [data.city, data.regionName].filter(Boolean).join(', ') || data.country || 'Unknown',
    };
    cached = location;
    return location;
  } catch {
    return null;
  }
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
