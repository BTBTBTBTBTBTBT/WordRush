import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  DESKTOP_3COL_MIN, DESKTOP_MAX, DESKTOP_MIN, DESKTOP_XL_MIN, WIDE_MIN,
  homeCardColumns, layoutTier, minWidthQuery, showsBottomTabs, tabPageColumns,
} from './desktop-layout';

// The desktop website layout (lib/desktop-layout.ts; app/globals.css
// "Desktop website" block). Phones (< 900 px) must never be touched; the AG
// tier (900–1023 px) keeps its two columns; ≥ 1024 px is the website.

const root = path.resolve(__dirname, '..');
const read = (p: string) => readFileSync(path.join(root, p), 'utf8');
const css = read('app/globals.css');
const start = css.indexOf('/* ── Desktop website (≥ 1024 px');
const end = css.indexOf('/* ── ', start + 10);
const block = css.slice(start, end === -1 ? undefined : end);

describe('layout tiers', () => {
  it('splits phone / wide / desktop at 900 and 1024', () => {
    expect(WIDE_MIN).toBe(900);
    expect(DESKTOP_MIN).toBe(1024);
    expect(layoutTier(375)).toBe('phone');
    expect(layoutTier(899)).toBe('phone');
    expect(layoutTier(899.98)).toBe('phone');
    expect(layoutTier(900)).toBe('wide');
    expect(layoutTier(1023)).toBe('wide');
    expect(layoutTier(1024)).toBe('desktop');
    expect(layoutTier(2560)).toBe('desktop');
    expect(layoutTier(Number.NaN)).toBe('phone');
  });

  it('lays Home cards 2 / 2 / 3 / 4 across', () => {
    expect(homeCardColumns(390)).toBe(2);
    expect(homeCardColumns(1000)).toBe(2);
    expect(homeCardColumns(1024)).toBe(3);
    expect(homeCardColumns(DESKTOP_XL_MIN - 1)).toBe(3);
    expect(homeCardColumns(DESKTOP_XL_MIN)).toBe(4);
    expect(homeCardColumns(1920)).toBe(4);
  });

  it('gives the tab pages one, two, then two or three columns', () => {
    for (const page of ['home', 'leaderboard', 'stats', 'friends'] as const) {
      expect(tabPageColumns(page, 390)).toBe(1);
      expect(tabPageColumns(page, 960)).toBe(2);
    }
    expect(tabPageColumns('leaderboard', 1100)).toBe(2);
    expect(tabPageColumns('friends', DESKTOP_3COL_MIN - 1)).toBe(2);
    expect(tabPageColumns('leaderboard', DESKTOP_3COL_MIN)).toBe(3);
    expect(tabPageColumns('leaderboard', 1280)).toBe(3);
    expect(tabPageColumns('friends', 1280)).toBe(3);
    expect(tabPageColumns('stats', 1280)).toBe(2);
    expect(tabPageColumns('home', 1280)).toBe(2);
  });

  it('moves the tabs to the top bar only on desktop tab pages', () => {
    expect(showsBottomTabs(390, true)).toBe(true);
    expect(showsBottomTabs(960, true)).toBe(true);
    expect(showsBottomTabs(1280, true)).toBe(false);
    // Game screens (no top bar) keep the docked tabs at every width.
    expect(showsBottomTabs(1280, false)).toBe(true);
    expect(minWidthQuery(DESKTOP_MIN)).toBe('(min-width: 1024px)');
  });
});

describe('desktop block (globals.css)', () => {
  it('exists, with the approved numbers', () => {
    expect(start).toBeGreaterThan(-1);
    expect(block).toContain(`--desk-max: ${DESKTOP_MAX}px;`);
    expect(block).toMatch(/--page-wide: var\(--desk-max\)/);
  });

  it('only acts at the desktop widths: outside its media queries it just hides the desktop-only pieces', () => {
    const firstMedia = block.indexOf('@media');
    const head = block.slice(0, firstMedia).replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = head.match(/[^{}]+\{[^}]*\}/g) ?? [];
    const selectors = rules.map((r) => r.slice(0, r.indexOf('{')).trim());
    expect(selectors).toEqual([':root', '.dk-tabs, .dk-only', '.home-hero']);
    expect(head).toMatch(/\.dk-tabs, \.dk-only \{ display: none; \}/);
    expect(head).toMatch(/\.home-hero \{ display: contents; \}/);
    const queries = [...block.matchAll(/@media ([^{]+)\{/g)].map((m) => m[1].trim());
    expect(queries.length).toBeGreaterThan(0);
    for (const q of queries) {
      const px = Number(q.match(/min-width: (\d+)px/)?.[1]);
      expect(px, q).toBeGreaterThanOrEqual(DESKTOP_MIN);
      expect([DESKTOP_MIN, DESKTOP_3COL_MIN, DESKTOP_XL_MIN]).toContain(px);
    }
  });

  it('makes the header a sticky three-part top bar and hides the docked tabs on those pages', () => {
    expect(block).toMatch(/\.app-hdr\.page-col \{[^}]*position: sticky;[^}]*grid-template-columns: minmax\(0, 1fr\) auto minmax\(0, 1fr\)/);
    expect(block).toMatch(/\.app-hdr > \.hdr-cast \{[^}]*grid-column: 1/);
    expect(block).toMatch(/\.app-hdr > \.dk-tabs \{[^}]*grid-column: 2;[^}]*display: flex/);
    expect(block).toMatch(/\.app-hdr > \.hdr-row \{[^}]*grid-column: 3/);
    expect(block).toMatch(/body:has\(\.app-hdr\) \.tab-dock \{ display: none; \}/);
  });

  it('lays Home, Leaderboard, Friends and Stats out as approved', () => {
    expect(block).toMatch(/\.home-cards\.grid \{ grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(block).toMatch(/\.home-cards\.grid \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
    expect(block).toMatch(/@media \(min-width: 1200px\) \{\s*\/\*[^*]*\*\/\s*\.lb-desk \{/);
    expect(block).toMatch(/\.lb-desk \{[^}]*grid-template-columns: minmax\(300px, 360px\) minmax\(0, 1fr\) minmax\(0, 1fr\)/);
    expect(block).toMatch(/\.lb-desk > \.page-grid-2 \{ display: contents; \}/);
    expect(block).toMatch(/\.fr-desk \{[^}]*grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
    expect(block).toMatch(/\.fr-desk > \.page-grid-2 \{ display: contents; \}/);
    expect(block).toMatch(/\.page-grid-2\.stats-desk \{[^}]*minmax\(320px, 380px\)/);
  });

  it('uses the wide wallpaper on every desktop width', () => {
    expect(css).toMatch(/@media \(min-aspect-ratio: 1\/1\), \(min-width: 1024px\) \{\s*\.page-bg/);
  });
});

describe('desktop call sites', () => {
  it('puts the candy pill tabs in the shared header', () => {
    const hdr = read('components/ui/app-header.tsx');
    expect(hdr).toMatch(/<header [^>]*className="app-hdr\b/);
    expect(hdr).toContain('<DesktopTabs />');
    expect(hdr).toMatch(/className="hdr-row\b/);
    expect(hdr).toMatch(/className="hdr-cast\b/);
    const tabs = read('components/ui/desktop-tabs.tsx');
    expect(tabs).toContain('className="dk-tabs"');
    expect(tabs).toMatch(/candyClass\(\{ color: isActive \? 'purple' : 'peach'/);
  });

  it('shares the tabs, tap rules and badge between the two tab rows', () => {
    for (const f of ['components/ui/bottom-nav.tsx', 'components/ui/desktop-tabs.tsx']) {
      const src = read(f);
      expect(src, f).toContain("from '@/components/ui/tab-nav'");
      expect(src, f).toContain('useFriendsBadge(');
      expect(src, f).toContain('NAV_ITEMS.map');
    }
  });

  it('marks the dashboard and the column layouts', () => {
    const home = read('app/page.tsx');
    expect(home).toContain('className="home-hero"');
    expect(home).toContain('className="dk-only"');
    expect(home).toContain('<HomeTodayCard');
    expect(home).toMatch(/className="home-cards grid grid-cols-2/);
    expect(home).toMatch(/className="home-games page-grid-2/);
    expect(read('app/daily/page.tsx')).toMatch(/className="lb-desk /);
    expect(read('app/stats/page.tsx')).toMatch(/className="page-grid-2 stats-desk /);
    expect(read('components/friends/friends-panel.tsx')).toMatch(/className="fr-desk /);
  });
});
