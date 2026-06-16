import { WC_TROPHY_LOGO_SRC } from '@/config/worldCupMedia';

let trophyImagePromise: Promise<HTMLImageElement | null> | null = null;

/** Load the World Cup trophy logo for canvas rendering (cached). */
export function loadWcTrophyImage(): Promise<HTMLImageElement | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!trophyImagePromise) {
    trophyImagePromise = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = WC_TROPHY_LOGO_SRC;
    });
  }
  return trophyImagePromise;
}
