import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SOFT, alphaHex, darken, overAlpha, softBackground, softBorder, softCard, softIconTile, softMix, softPill } from './soft-surface';

// FINISH_SPEC A1: background ≈ mix(accent 12–14%, white), border ≈ mix(accent 30–35%, white).

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

describe('color mixing', () => {
  it('writes an alpha byte onto a hex color', () => {
    expect(alphaHex('#7c3aed', 0.13)).toBe('#7c3aed21');
    expect(alphaHex('#7c3aed', 1)).toBe('#7c3aedff');
    expect(alphaHex('#fff', 0)).toBe('#ffffff00');
    expect(alphaHex('#7C3AED', 2)).toBe('#7c3aedff');
  });

  it('mixes an accent over white (and any base)', () => {
    expect(softMix('#7c3aed', 0, '#ffffff')).toBe('#ffffff');
    expect(softMix('#7c3aed', 1, '#ffffff')).toBe('#7c3aed');
    expect(softMix('#7c3aed', 0.13)).toBe('#eee5fd');
    expect(softMix('#000000', 0.5, '#ffffff')).toBe('#808080');
  });

  it('keeps the wash inside the approved 12–14% band and the border in 30–35%', () => {
    expect(SOFT.tint).toBeGreaterThanOrEqual(0.12);
    expect(SOFT.tint).toBeLessThanOrEqual(0.14);
    expect(SOFT.line).toBeGreaterThanOrEqual(0.3);
    expect(SOFT.line).toBeLessThanOrEqual(0.35);
  });

  it('solves the border alpha so border-over-wash reads as the line share', () => {
    const a = overAlpha(SOFT.line, SOFT.tint);
    // compositing: 1 − (1 − tint)(1 − a) = line
    expect(1 - (1 - SOFT.tint) * (1 - a)).toBeCloseTo(SOFT.line, 6);
    expect(overAlpha(0.3, 0)).toBeCloseTo(0.3, 6);
    expect(overAlpha(0.1, 0.2)).toBe(0);
    expect(overAlpha(0.5, 1)).toBe(0);
  });

  it('is never plain white over the light base', () => {
    const [r, g, b] = rgb(softMix('#f59e0b', SOFT.tint));
    expect(r === 255 && g === 255 && b === 255).toBe(false);
  });
});

describe('candy button lips (A8)', () => {
  it('darkens each gradient bottom ~35% for its lip (the values globals.css .candy-* use)', () => {
    expect(darken('#6d28d9', 0.35)).toBe('#471a8d');
    expect(darken('#a21caf', 0.35)).toBe('#691272');
    expect(darken('#f97316', 0.35)).toBe('#a24b0e');
    expect(darken('#0d9488', 0.35)).toBe('#086058');
    expect(darken('#fbb38f', 0.35)).toBe('#a3745d');
    expect(darken('#ffffff', 0)).toBe('#ffffff');
    expect(darken('#ffffff', 1)).toBe('#000000');
  });

  it('matches the stylesheet', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    for (const [name, bottom] of [['purple', '#6d28d9'], ['pink', '#a21caf'], ['amber', '#f97316'], ['teal', '#0d9488'], ['peach', '#fbb38f']] as const) {
      const rule = css.match(new RegExp(`\\.candy-${name} \\{([^}]*)\\}`))?.[1] ?? '';
      expect(rule, name).toContain(`--candy-2: ${bottom}`);
      expect(rule, name).toContain(`--candy-lip: ${darken(bottom, 0.35)}`);
    }
  });
});

describe('surface helpers', () => {
  it('lays the wash over the card base so dark mode keeps its dark surface', () => {
    expect(softBackground('#7c3aed')).toBe('linear-gradient(#7c3aed21, #7c3aed21), var(--color-card-base, #ffffff)');
    expect(softBorder('#7c3aed')).toMatch(/^1\.5px solid #7c3aed[0-9a-f]{2}$/);
  });

  it('builds cards, icon tiles and pills with the accent', () => {
    const card = softCard('#2563eb', { radius: 20 });
    expect(card.borderRadius).toBe(20);
    expect(String(card.background)).toContain('#2563eb21');
    const sel = softCard('#2563eb', { selected: true });
    expect(sel.border).toBe('2px solid #2563eb');
    const icon = softIconTile('#ec4899');
    expect(String(icon.boxShadow)).toContain(`inset 0 ${SOFT.iconBar}px 0 #ec4899`);
    const on = softIconTile('#ec4899', { selected: true });
    expect(on.border).toBe('2px solid #ec4899');
    expect(String(softPill('#7c3aed').boxShadow)).toContain('inset 0 4px 0 #7c3aed');
    expect(String(softPill('#7c3aed', { bar: false }).boxShadow)).not.toContain('inset');
  });
});
