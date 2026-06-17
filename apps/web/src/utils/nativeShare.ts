export type ShareContent = {
  title: string;
  url: string;
  file?: File | null;
};

export type ShareResult = 'shared' | 'aborted' | 'unsupported';

function canShareData(data: ShareData): boolean {
  if (typeof navigator === 'undefined' || !navigator.canShare) return true;
  try {
    return navigator.canShare(data);
  } catch {
    return false;
  }
}

async function tryShare(data: ShareData): Promise<ShareResult> {
  try {
    await navigator.share(data);
    return 'shared';
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'aborted';
    return 'unsupported';
  }
}

/**
 * Native share sheet.
 * Image shares are file-only — the PNG has trophy branding, picks, and link.
 * Title/text/URL cause WhatsApp and iMessage to add a redundant caption or link preview.
 */
export async function shareContent({ title, url, file }: ShareContent): Promise<ShareResult> {
  if (typeof navigator === 'undefined' || !navigator.share) return 'unsupported';

  if (file) {
    const imageOnly: ShareData = { files: [file] };
    if (canShareData(imageOnly)) {
      const result = await tryShare(imageOnly);
      if (result !== 'unsupported') return result;
    }
  }

  const caption = `${title}\n${url}`;
  const textPayload: ShareData = { title, text: caption };
  if (canShareData(textPayload)) {
    const result = await tryShare(textPayload);
    if (result !== 'unsupported') return result;
  }

  return 'unsupported';
}

export async function canvasToShareFile(
  canvas: HTMLCanvasElement,
  filename: string,
): Promise<File | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  return new File([blob], filename, { type: 'image/png' });
}

export function downloadCanvasImage(canvas: HTMLCanvasElement, filename: string) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
