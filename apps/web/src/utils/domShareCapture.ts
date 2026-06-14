import { toCanvas } from 'html-to-image';

/** Wait for <img> nodes inside the capture root (flags, avatar). */
export async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          img.addEventListener('load', () => resolve(), { once: true });
          img.addEventListener('error', () => resolve(), { once: true });
        }),
    ),
  );
}

/** Snapshot a DOM node exactly as rendered on screen (WYSIWYG share card). */
export async function captureElementToCanvas(
  element: HTMLElement,
  pixelRatio = 2,
): Promise<HTMLCanvasElement> {
  await waitForImages(element);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });

  return toCanvas(element, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: '#0f172a',
  });
}

export async function waitForDomPickCount(
  root: HTMLElement,
  expected: number,
  attempts = 12,
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    const count = root.querySelectorAll('[data-share-pick]').length;
    if (count === expected) return true;
    await new Promise((r) => setTimeout(r, 50));
  }
  return root.querySelectorAll('[data-share-pick]').length === expected;
}
