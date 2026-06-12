import { useEffect, useState } from 'react';
import { useAuthContext } from '@/hooks/useAuthContext';
import { authService } from '@/services/authService';
import { profileService } from '@/services/profileService';
import { getRealPrimaryPhotoUrl, resolveProfilePhotoUrl } from '@/utils/profilePhotos';

function photoStorageKey(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed.replace(/^\//, '');
  try {
    const host = new URL(trimmed).hostname;
    if (!host.includes('amazonaws.com')) return null;
    return new URL(trimmed).pathname.replace(/^\//, '');
  } catch {
    return null;
  }
}

/** Resolves header avatar — public S3 URL first, presigned fallback for private bucket keys. */
export function useHeaderAvatarPhoto(photoUrls: string[] | undefined | null): string | null {
  const { isAuthenticated } = useAuthContext();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const raw = getRealPrimaryPhotoUrl(photoUrls);
    if (!raw) {
      setSrc(null);
      return;
    }

    const publicUrl = resolveProfilePhotoUrl(raw);
    setSrc(publicUrl);

    if (!isAuthenticated) return;
    const key = photoStorageKey(raw);
    if (!key) return;

    let cancelled = false;
    void (async () => {
      try {
        const token = await authService.getJWT();
        if (!token || cancelled) return;
        const signed = await profileService.getPhotoUrl(token, key);
        if (!cancelled && signed) setSrc(signed);
      } catch {
        /* keep public URL attempt */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [photoUrls, isAuthenticated]);

  return src;
}
