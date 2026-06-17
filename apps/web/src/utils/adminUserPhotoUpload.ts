import { adminApiService } from '@/services/adminApiService';

function inferImageContentType(file: File): string {
  const t = (file.type || '').trim();
  if (t.startsWith('image/')) return t;
  const name = file.name || '';
  const dot = name.lastIndexOf('.');
  const ext = dot >= 0 ? name.slice(dot).toLowerCase() : '';
  const byExt: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.heic': 'image/heic',
    '.heif': 'image/heic',
  };
  if (ext && byExt[ext]) return byExt[ext];
  return 'image/jpeg';
}

/** Upload through API (Lambda→S3) and attach to the user's profile. */
export async function uploadAdminUserProfilePhoto(
  userId: string,
  file: File,
  replaceIndex?: number,
): Promise<unknown> {
  const contentType = inferImageContentType(file);
  const wrapped = new File([file], file.name || 'image.jpg', { type: contentType });
  const fd = new FormData();
  fd.append('file', wrapped);
  const q =
    replaceIndex != null && replaceIndex >= 0
      ? `?replaceIndex=${encodeURIComponent(String(replaceIndex))}`
      : '';
  return adminApiService.postForm(
    `/api/admin/users/${encodeURIComponent(userId)}/photos/upload${q}`,
    fd,
  );
}

export async function removeAdminUserProfilePhoto(userId: string, index: number): Promise<unknown> {
  return adminApiService.delete(
    `/api/admin/users/${encodeURIComponent(userId)}/photos?index=${encodeURIComponent(String(index))}`,
  );
}
