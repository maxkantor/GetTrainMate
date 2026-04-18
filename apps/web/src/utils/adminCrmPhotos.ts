import { API_BASE_URL } from '@/config/api';
import { getAdminToken } from '@/services/adminAuthStorage';

/** Same-origin stream (token in query) — works when S3 is private or CORS blocks direct GET. */
export function adminProfilePhotoStreamUrl(userId: string, slotIndex: number): string | null {
  const t = getAdminToken();
  if (!t || !userId) return null;
  const q = new URLSearchParams({ index: String(slotIndex), adminToken: t });
  return `${API_BASE_URL}/api/admin/users/${encodeURIComponent(userId)}/photos/stream?${q.toString()}`;
}

/** Stream endpoint only resolves keys under profiles/{userId}/… */
export function canonicalUrlIsStreamableProfileImage(userId: string, canonicalLine: string): boolean {
  const uid = userId.trim();
  const line = canonicalLine.trim();
  if (!uid || !line) return false;
  try {
    const u = new URL(line);
    if (u.protocol !== 'https:') return false;
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, '')).toLowerCase();
    const needle = `profiles/${uid.toLowerCase()}/`;
    return path.startsWith(needle) || path.includes(`/${needle}`);
  } catch {
    return false;
  }
}

export function resolveAdminCrmPhotoSrc(
  userId: string,
  slotIndex: number,
  canonicalLine: string,
  previewLine: string | undefined
): string {
  const c = canonicalLine.trim();
  if (!c) return '';
  if (canonicalUrlIsStreamableProfileImage(userId, c)) {
    const stream = adminProfilePhotoStreamUrl(userId, slotIndex);
    if (stream) return stream;
  }
  const p = (previewLine ?? '').trim();
  return p || c;
}
