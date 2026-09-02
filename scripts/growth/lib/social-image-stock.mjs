/**
 * Free stock photography for owned social — curated Unsplash URLs, no Bedrock cost.
 */
import { assessPhotoQuality } from './social-image-bedrock.mjs';
import { stockPhotosForMode, unsplashCropUrl } from './social-image-stock-library.mjs';

function hashSeed(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function selectStockPhoto({
  mode,
  contentId = '',
  isoDate = '',
  activity = '',
  recentEntries = []
} = {}) {
  let pool = stockPhotosForMode(mode);
  const act = String(activity || '').toLowerCase();
  if (act) {
    const matched = pool.filter((p) => (p.activities || []).includes(act));
    if (matched.length) pool = matched;
  }
  const usedIds = new Set(
    (recentEntries || []).map((e) => e.stockPhotoId || '').filter(Boolean)
  );
  const seed = hashSeed(`${isoDate}:${contentId}:${mode}`);
  const sorted = [...pool].sort((a, b) => a.id.localeCompare(b.id));
  const fresh = sorted.filter((p) => !usedIds.has(p.id));
  const candidates = fresh.length ? fresh : sorted;
  for (let offset = 0; offset < candidates.length; offset++) {
    const photo = candidates[(seed + offset * 17) % candidates.length];
    const visualUsed = (recentEntries || []).some(
      (e) => String(e.stockPhotoId || '') === photo.id || String(e.visualConcept || '') === photo.scene
    );
    if (!visualUsed || offset === candidates.length - 1) {
      return { ...photo, url: unsplashCropUrl(photo.unsplashId) };
    }
  }
  const fallback = candidates[seed % candidates.length];
  return { ...fallback, url: unsplashCropUrl(fallback.unsplashId) };
}

export async function fetchStockPhotoBuffer(photo, { fetchImpl = globalThis.fetch, timeoutMs = 20000 } = {}) {
  const url = photo?.url || unsplashCropUrl(photo?.unsplashId);
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetchImpl(url, controller ? { signal: controller.signal } : {});
    if (!res.ok) {
      return { ok: false, error: `stock_fetch_${res.status}`, url };
    }
    const buffer = Buffer.from(await res.arrayBuffer());
    return { ok: true, buffer, url, photoId: photo?.id || '', modelId: 'unsplash_stock' };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'stock_fetch_failed',
      url
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function generateStockPhoto(
  concept,
  { isoDate, activity, recentEntries = [], sharpImpl, maxAttempts = 3, fetchImpl } = {}
) {
  let lastError = 'unknown';
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const photo = selectStockPhoto({
      mode: concept.mode,
      contentId: `${concept.contentId}:${attempt}`,
      isoDate: `${isoDate}:${attempt}`,
      activity,
      recentEntries
    });
    const fetched = await fetchStockPhotoBuffer(photo, { fetchImpl });
    if (!fetched.ok) {
      lastError = fetched.error;
      continue;
    }
    const quality = await assessPhotoQuality(fetched.buffer, sharpImpl);
    if (!quality.ok) {
      lastError = quality.reason;
      continue;
    }
    return {
      ok: true,
      buffer: fetched.buffer,
      modelId: 'unsplash_stock',
      stockPhotoId: photo.id,
      sourceUrl: fetched.url,
      scene: photo.scene,
      seed: hashSeed(`${isoDate}:${concept.contentId}:${photo.id}`),
      quality
    };
  }
  return { ok: false, error: lastError };
}
