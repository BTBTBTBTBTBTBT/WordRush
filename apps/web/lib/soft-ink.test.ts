import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SOFT_INK, accentInk, accentInkDark, darken } from './soft-surface';

// The dark-mode ink lever (lib/soft-surface.ts SOFT_INK + accentInk, globals.css).

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** The dark theme's card base (globals.css [data-theme="dark"] --color-card-base). */
const DARK_CARD = '#252542';

describe('accentInk', () => {
  it('carries the light ink (default: the accent darkened 30%) and a pastel dark ink', () => {
    const ink = accentInk('#22a866');
    expect(ink.className).toBe('soft-ink');
    expect((ink.style as Record<string, string>)['--ink-l']).toBe(darken('#22a866', 0.3));
    expect((ink.style as Record<string, string>)['--ink-d']).toBe(accentInkDark('#22a866'));
    expect((accentInk('#f5a524', '#a2560c').style as Record<string, string>)['--ink-l']).toBe('#a2560c');
  });

  it('keeps every card accent legible on the dark card (WCAG AA for small text)', () => {
    for (const accent of ['#7c3aed', '#2563eb', '#22a866', '#f5a524', '#ec4899', '#0d9488', '#dc2626']) {
      expect(contrast(accentInkDark(accent), DARK_CARD), accent).toBeGreaterThan(4.5);
    }
  });
});

describe('SOFT_INK', () => {
  it('reads theme vars that the stylesheet defines for light, dark and light-only pages', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const v of Object.values(SOFT_INK)) {
      const name = v.match(/var\((--[a-z-]+),/)?.[1];
      expect(name, v).toBeTruthy();
      const defs = css.match(new RegExp(`${name}:\\s*#[0-9a-f]{6}`, 'g')) ?? [];
      expect(defs.length, name).toBeGreaterThanOrEqual(3);
    }
    expect(css).toMatch(/\.soft-num \{[^}]*color: var\(--soft-ink/);
  });

  it('the dark inks clear AA on the dark card', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    const dark = css.match(/\[data-theme="dark"\] \{\n  --soft-ink:[^}]*\}/)?.[0] ?? '';
    const inks = [...dark.matchAll(/--soft-[a-z]+: (#[0-9a-f]{6})/g)].map((m) => m[1]);
    expect(inks.length).toBe(5);
    for (const ink of inks) expect(contrast(ink, DARK_CARD), ink).toBeGreaterThan(4.5);
  });
});
