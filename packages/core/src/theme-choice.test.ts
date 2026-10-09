import { describe, it, expect } from 'vitest';
import fixtures from './theme-choice-fixtures.json';
import {
  effectiveTheme, parseBaseTheme, pickTheme, seasonEndLabel, showSeasonalRow, type BaseTheme, type ThemeChoice,
} from './theme-choice';

const choice = (theme: string, optOut: string | null): ThemeChoice => ({ theme: theme as BaseTheme, seasonOptOut: optOut });

describe('theme choice fixtures (shared with Swift + Kotlin)', () => {
  it('effective theme', () => {
    for (const { in: [theme, optOut, season, on, date], out } of fixtures.effective as any[]) {
      const r = effectiveTheme(choice(theme, optOut), season, on, date);
      expect([r.base, r.seasonal], JSON.stringify([theme, optOut, season, on, date])).toEqual(out);
    }
  });
  it('pick', () => {
    for (const { in: [theme, optOut, picked, season, date], out } of fixtures.pick as any[]) {
      const r = pickTheme(choice(theme, optOut), picked, season, date);
      expect([r.theme, r.seasonOptOut], JSON.stringify([theme, optOut, picked, season, date])).toEqual(out);
    }
  });
  it('row + end label', () => {
    for (const { in: [season, on], out } of fixtures.showRow as any[]) expect(showSeasonalRow(season, on)).toBe(out);
    for (const { in: s, out } of fixtures.endLabel as any[]) expect(seasonEndLabel(s)).toBe(out);
  });
  it('season end restores the previous theme: the base theme is never touched by a season', () => {
    const c = pickTheme(choice('ocean', null), 'seasonal', 'halloween', '2026-10-12');
    expect(effectiveTheme(c, 'halloween', true, '2026-10-12')).toEqual({ base: 'ocean', seasonal: true });
    expect(effectiveTheme(c, null, true, '2026-11-01')).toEqual({ base: 'ocean', seasonal: false });
  });
  it('parseBaseTheme is tolerant', () => {
    expect(parseBaseTheme('forest')).toBe('forest');
    expect(parseBaseTheme('neon')).toBe('default');
    expect(parseBaseTheme(null)).toBe('default');
  });
});
