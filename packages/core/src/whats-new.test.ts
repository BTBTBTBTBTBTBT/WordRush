import { describe, expect, it } from 'vitest';
import { WHATS_NEW_CUTOFF, WHATS_NEW_KEY, WHATS_NEW_PAGES, whatsNewDecision, whatsNewPages } from './whats-new';

const base = { live: true, seen: [] as string[], signedIn: true, hasOnboarded: true, createdAt: '2026-08-01T10:00:00Z' };

describe("What's new in 2.8 (item 41)", () => {
  it('six pages: Halloween + theme, living mascots, reorder, invites + pocket, widgets, mascot packs', () => {
    expect(WHATS_NEW_PAGES.map((p) => p.id)).toEqual(['season', 'alive', 'order', 'invites', 'widgets', 'packs']);
    for (const p of WHATS_NEW_PAGES) {
      expect(p.title).toBe(p.title.toUpperCase());
      expect(p.lines.length).toBeGreaterThanOrEqual(1);
      expect(p.lines.length).toBeLessThanOrEqual(2);
    }
  });
  it('widgets are an app feature: web leaves that page out', () => {
    expect(whatsNewPages('web').map((p) => p.id)).not.toContain('widgets');
    expect(whatsNewPages('ios').map((p) => p.id)).toContain('widgets');
    expect(whatsNewPages('android')).toHaveLength(6);
  });
  it('an existing player who has not seen it gets the tour', () => {
    expect(whatsNewDecision(base)).toBe('show');
  });
  it('a brand-new player never sees it (account on/after the cutoff, or not yet onboarded): the key is recorded', () => {
    expect(whatsNewDecision({ ...base, createdAt: `${WHATS_NEW_CUTOFF}T00:00:00Z` })).toBe('record');
    expect(whatsNewDecision({ ...base, createdAt: '2026-11-02T00:00:00Z' })).toBe('record');
    expect(whatsNewDecision({ ...base, hasOnboarded: false })).toBe('record');
  });
  it('seen, switched off, or a guest: nothing', () => {
    expect(whatsNewDecision({ ...base, seen: [WHATS_NEW_KEY] })).toBe('none');
    expect(whatsNewDecision({ ...base, live: false })).toBe('none');
    expect(whatsNewDecision({ ...base, signedIn: false })).toBe('none');
  });
  it('waits while the seen list or the profile is still loading (never decides on a guess)', () => {
    expect(whatsNewDecision({ ...base, seen: null })).toBe('wait');
    expect(whatsNewDecision({ ...base, hasOnboarded: null })).toBe('wait');
  });
});
