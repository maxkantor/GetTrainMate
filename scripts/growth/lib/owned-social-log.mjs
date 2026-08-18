import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOG_PATH = path.join(__dirname, '../../docs/growth/owned-social/published-log.json');

export function readPublishedLog(logPath = LOG_PATH) {
  if (!fs.existsSync(logPath)) return { entries: [] };
  try {
    const parsed = JSON.parse(fs.readFileSync(logPath, 'utf8'));
    return { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  } catch {
    return { entries: [] };
  }
}

export function recentlyUsedContentIds(log, { days = 14, now = Date.now() } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return (log.entries || [])
    .filter((e) => e.status === 'published' && Date.parse(e.publishedAtUtc || 0) >= cutoff)
    .map((e) => e.contentId)
    .filter(Boolean);
}

export function appendPublishedLog(entry, logPath = LOG_PATH) {
  const current = readPublishedLog(logPath);
  current.entries = [...(current.entries || []), entry].slice(-200);
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  fs.writeFileSync(logPath, `${JSON.stringify(current, null, 2)}\n`, 'utf8');
  return current;
}
