import { describe, it, expect } from 'vitest';
import {
  classifyDiscoveryStatus,
  contactJobProgressFrom,
  summarizeBulkResearch,
  summarizeResearchResult,
} from './researchContact';

describe('summarizeResearchResult', () => {
  it('reports found email', () => {
    const s = summarizeResearchResult(
      { found: true, email: 'a@gym.test', ok: true },
      'Planet Fitness',
    );
    expect(s.ok).toBe(true);
    expect(s.kind).toBe('found');
    expect(s.text).toContain('a@gym.test');
    expect(s.text).toContain('Planet Fitness');
  });

  it('reports not found with next date', () => {
    const s = summarizeResearchResult(
      {
        ok: true,
        found: false,
        nextResearchAt: '2026-09-25T00:00:00Z',
      },
      'Square One',
    );
    expect(s.ok).toBe(false);
    expect(s.kind).toBe('not_found');
    expect(s.text).toMatch(/No public email for Square One/);
  });

  it('reports dead Wix / parking website clearly', () => {
    const s = summarizeResearchResult(
      {
        ok: true,
        found: false,
        reason: 'website_dead',
        websiteStatus: 'ParkingOrDisconnected',
        websiteDetail:
          'Website is a Wix placeholder — domain is not connected to a live site.',
      },
      'Square One',
    );
    expect(s.ok).toBe(false);
    expect(s.kind).toBe('website_dead');
    expect(s.text).toMatch(/Wix|not connected/i);
  });

  it('reports cooldown skip (the blink bug case)', () => {
    const s = summarizeResearchResult(
      { ok: false, skipped: true, reason: 'retry_later' },
      'Square One',
    );
    expect(s.ok).toBe(false);
    expect(s.kind).toBe('skipped');
    expect(s.text).toContain('still in cooldown');
  });

  it('reports max attempts', () => {
    const s = summarizeResearchResult(
      { ok: false, skipped: true, reason: 'max_research_attempts' },
      'Gym',
    );
    expect(s.text).toContain('max attempts');
  });

  it('reports no_website failure', () => {
    const s = summarizeResearchResult(
      { ok: false, error: 'no_website', message: 'Prospect has no website to research.' },
      'Gym',
    );
    expect(s.kind).toBe('failed');
    expect(s.text).toMatch(/no_website|no website/i);
  });
});

describe('summarizeBulkResearch', () => {
  it('aggregates mixed found and missed', () => {
    const names = new Map([
      ['p1', 'Alpha'],
      ['p2', 'Beta'],
    ]);
    const s = summarizeBulkResearch(
      [
        { prospectId: 'p1', found: true, email: 'a@x.test', ok: true },
        { prospectId: 'p2', found: false, ok: true },
      ],
      names,
      2,
    );
    expect(s.ok).toBe(true);
    expect(s.text).toMatch(/Found 1 contact/);
    expect(s.text).toMatch(/1 no email/);
  });

  it('reports all missed honestly (not fake success)', () => {
    const s = summarizeBulkResearch(
      [{ prospectId: 'p1', skipped: true, reason: 'retry_later', ok: false }],
      new Map([['p1', 'Square One']]),
      1,
    );
    expect(s.ok).toBe(false);
    expect(s.text).toMatch(/No contacts found/);
    expect(s.text).toMatch(/cooldown/);
  });
});

describe('classifyDiscoveryStatus', () => {
  it('never invents an email class from a domain-only prospect', () => {
    expect(classifyDiscoveryStatus('CONTACT_NEEDED', false)).toBe(null);
    expect(classifyDiscoveryStatus('EMAIL_FOUND', true)).toBe('PUBLIC EMAIL FOUND');
    expect(classifyDiscoveryStatus('NO_PUBLIC_CONTACT', false)).toBe('NO PUBLIC EMAIL');
    expect(classifyDiscoveryStatus('REVIEW_REQUIRED', false)).toBe('NEEDS REVIEW');
    expect(classifyDiscoveryStatus('INVALID', false)).toBe('INVALID');
    expect(classifyDiscoveryStatus('ERROR', false)).toBe('ERROR');
  });
});

describe('contactJobProgressFrom', () => {
  it('does not report a percentage until at least one prospect is processed', () => {
    const p = contactJobProgressFrom({
      jobId: 'j1',
      status: 'running',
      total: 10,
      processed: 0,
      progressPct: 40,
    });
    expect(p.measurable).toBe(false);
    expect(p.progressPct).toBe(null);
  });

  it('computes a real percentage from processed / total', () => {
    const p = contactJobProgressFrom({
      jobId: 'j1',
      status: 'running',
      total: 10,
      processed: 4,
      emailsFound: 2,
      noContact: 1,
      errors: 1,
    });
    expect(p.measurable).toBe(true);
    expect(p.progressPct).toBe(40);
    expect(p.emailsFound).toBe(2);
    expect(p.noContact).toBe(1);
    expect(p.errors).toBe(1);
  });
});
