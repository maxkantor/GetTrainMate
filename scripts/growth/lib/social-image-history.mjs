import { readPublishedLog } from './owned-social-log.mjs';

export function recentImageEntries(log, { days = 30, now = Date.now() } = {}) {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return (log.entries || [])
    .filter((e) => Date.parse(e.publishedAtUtc || e.generatedAtUtc || 0) >= cutoff)
    .map((e) => ({
      contentId: e.contentId,
      imageHeadline: e.imageHeadline || '',
      visualConcept: e.visualConcept || e.photoPrompt || '',
      photoPrompt: e.photoPrompt || e.visualConcept || '',
      cta: e.imageCta || e.cta || '',
      colorTreatment: e.colorTreatment || '',
      imageKey: e.imageKey || '',
      imageSeed: e.imageSeed ?? null,
      mode: e.mode || ''
    }))
    .filter((e) => e.imageHeadline || e.visualConcept || e.photoPrompt);
}

export function loadRecentImageHistory({ days = 30 } = {}) {
  return recentImageEntries(readPublishedLog(), { days });
}
