import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SOFT, accentInkDark, softMix } from './soft-surface';
import { MODES } from './modes.generated';

// FINISH_SPEC AD (web): every dark-theme ink on the tinted cards / popups clears
// WCAG AA (4.5:1) on the washed dark surface, not only on the bare dark card:
// the accent laid over the dark card base at the card wash (SOFT.tint) AND the
// selected wash (SOFT.strong), for every game accent plus the page accents.

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
/** The dark theme's card base, read from the stylesheet. */
const DARK_CARD = css.match(/\[data-theme="dark"\] \{[^}]*--color-card-base: (#[0-9a-f]{6})/)?.[1] ?? '#252542';

/** The effective dark value of a var: the LAST plain `[data-theme="dark"] {` block that sets it wins. */
function darkVar(name: string): string {
  const blocks = [...css.matchAll(/(?:^|\n)\[data-theme="dark"\] \{([^}]*)\}/g)].map((m) => m[1]);
  let v = '';
  for (const b of blocks) {
    const m = b.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`));
    if (m) v = m[1];
  }
  return v;
}
/** The effective dark color of `.tint-ink` (the last rule that sets it). */
function darkTintInk(): string {
  const all = [...css.matchAll(/\[data-theme="dark"\] \.tint-ink[^{]*\{\s*color:\s*([^;!]+)/g)].map((m) => m[1].trim());
  const last = all[all.length - 1] ?? '';
  if (last.startsWith('#')) return last;
  const v = last.match(/var\((--[a-z-]+)\)/)?.[1];
  return v ? darkVar(v) : '';
}

const ACCENTS = [...new Set([
  ...MODES.map((m) => m.accentHex.toLowerCase()),
  '#7c3aed', '#f59e0b', '#2563eb', '#ec4899', '#0d9488', '#f5a524', '#22a866',
])];

describe('dark-mode inks on washed surfaces (FINISH_SPEC AD)', () => {
  const inks: Record<string, string> = {
    '--soft-ink': darkVar('--soft-ink'),
    '--soft-title': darkVar('--soft-title'),
    '--soft-value': darkVar('--soft-value'),
    '--soft-label': darkVar('--soft-label'),
    '--soft-detail': darkVar('--soft-detail'),
    '--color-text': darkVar('--color-text'),
    '.tint-ink': darkTintInk(),
  };

  it('reads every ink from the stylesheet', () => {
    for (const [k, v] of Object.entries(inks)) expect(v, k).toMatch(/^#[0-9a-f]{6}$/);
  });

  for (const share of [SOFT.tint, SOFT.strong]) {
    it(`every ink clears 4.5:1 on every accent's ${Math.round(share * 100)}% dark wash`, () => {
      for (const accent of ACCENTS) {
        const bg = softMix(accent, share, DARK_CARD);
        for (const [k, ink] of Object.entries(inks)) {
          expect(contrast(ink, bg), `${k} ${ink} on ${accent} @${share}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(accentInkDark(accent), bg), `accentInkDark ${accent} @${share}`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
