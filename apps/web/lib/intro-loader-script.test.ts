import { it, expect } from 'vitest';
import { seasonLoaderScript } from './intro';

function run(month: number, day: number, ls: Record<string, string> = {}) {
  const src = seasonLoaderScript();
  const el: any = { style: {} };
  const g: any = {
    Date: class extends Date { constructor() { super(2026, month, day); } },
    URLSearchParams,
    location: { search: '' },
    sessionStorage: { getItem: () => null },
    localStorage: { getItem: (k: string) => ls[k] ?? null },
    document: { getElementById: () => el },
    matchMedia: () => ({ matches: false }),
  };
  new Function(...Object.keys(g), src)(...Object.values(g));
  return el.style.background as string | undefined;
}

it('loader script', () => {
  expect(run(9, 15)).toContain('art-wall-halloween-home.webp');
  expect(run(9, 15)).toContain('#0E091B');
  expect(run(10, 15)).toBeUndefined();
  expect(run(9, 8)).toBeUndefined();
  expect(run(9, 15, { 'wordocious-season-optout': 'halloween:2026' })).toBeUndefined();
  expect(run(9, 15, { 'wordocious-app-flags': JSON.stringify({ opening_animation_season: { enabled: false, audience: 'all' } }) })).toBeUndefined();
});
