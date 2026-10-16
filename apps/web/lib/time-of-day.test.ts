import { describe, expect, it } from 'vitest';
import { parseTod } from './time-of-day';
import { resolveSurfaces, seasonSurfaces, surfaceCssVars } from './season-kit';

describe('time of day (web)', () => {
  it('parses an override and rejects anything else', () => {
    expect(parseTod('morning')).toBe('morning');
    expect(parseTod(' Evening ')).toBe('evening');
    expect(parseTod('auto')).toBeNull();
    expect(parseTod(null)).toBeNull();
    expect(parseTod('noon')).toBeNull();
  });
  it('hands the document the time\'s window colors, the sheet glass and the wall ink', () => {
    const day = surfaceCssVars(seasonSurfaces('thanksgiving', null, 'day')!);
    expect(day['--color-card-base']).toBe('rgba(48, 60, 100, 0.88)');
    expect(day['--color-text-muted']).toBe('#CDD6F0');
    expect(day['--season-wall-ink']).toBe('#1B1230');
    expect(day['--season-sheet-top']).toBe('#44538C');
    const night = surfaceCssVars(seasonSurfaces('thanksgiving', null, 'night')!);
    expect(night['--season-wall-ink']).toBe('#FFFFFF');
    expect(night['--season-sheet-top']).toBe('#3E2029');
  });
  it('is the base outside any tod entry', () => {
    expect(resolveSurfaces({ card: '#111111' }, 'day')).toMatchObject({ card: '#111111', wallInk: 'light' });
  });
});
