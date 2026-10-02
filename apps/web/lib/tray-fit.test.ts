import { describe, expect, it } from 'vitest';
import { TRAY } from './game-tray';
import { BOARD_FIT } from './board-fit';
import { MINI_TRAY, fitGridInTray, modeTrayAccent, trayChrome, trayStateFor } from './tray-fit';

describe('trayChrome', () => {
  it('is the padding + border on each side, plus the lip at the bottom', () => {
    expect(trayChrome(11, 1.5)).toEqual({ x: 12.5, top: 12.5, bottom: 12.5 + TRAY.lip });
  });

  it('keeps the compact mini tray within the multi-board fit padding', () => {
    // miniBoardFrame: MINI_TRAY padding + the border (2 px when active) per side; the lip sits over the bottom padding.
    expect(2 * (MINI_TRAY.padding + 2)).toBeLessThanOrEqual(BOARD_FIT.boardPad);
  });
});

describe('fitGridInTray', () => {
  it('fits square tiles inside the measured box with the chrome taken out', () => {
    const chrome = trayChrome();
    const fit = fitGridInTray({ w: 340, h: 420 }, 5, 6, 5, chrome)!;
    expect(fit.w + 2 * chrome.x).toBeLessThanOrEqual(340);
    expect(fit.h + chrome.top + chrome.bottom).toBeLessThanOrEqual(420);
    expect(fit.w).toBeCloseTo(fit.tile * 5 + 5 * 4, 5);
    expect(fit.h).toBeCloseTo(fit.tile * 6 + 5 * 5, 5);
  });

  it('is limited by the tighter dimension', () => {
    const wide = fitGridInTray({ w: 800, h: 300 }, 5, 6, 5)!;
    const chrome = trayChrome();
    expect(wide.h + chrome.top + chrome.bottom).toBeLessThanOrEqual(300);
    expect(wide.h + chrome.top + chrome.bottom).toBeGreaterThan(296);
  });

  it('carries extra row width (word gaps) and returns null when nothing fits', () => {
    const fit = fitGridInTray({ w: 300, h: 400 }, 10, 6, 5, trayChrome(), 14)!;
    expect(fit.w).toBeCloseTo(fit.tile * 10 + 5 * 9 + 14, 5);
    expect(fitGridInTray({ w: 0, h: 400 }, 5, 6, 5)).toBeNull();
    expect(fitGridInTray({ w: 30, h: 30 }, 5, 6, 5)).toBeNull();
  });
});

describe('tray state + accent', () => {
  it('maps board statuses', () => {
    expect(trayStateFor('WON')).toBe('won');
    expect(trayStateFor('lost')).toBe('lost');
    expect(trayStateFor('PLAYING')).toBe('playing');
    expect(trayStateFor(undefined)).toBe('playing');
  });

  it('uses the catalog accent, the brand purple when unknown', () => {
    expect(modeTrayAccent('SUDOKU')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(modeTrayAccent('NOPE')).toBe('#7c3aed');
    expect(modeTrayAccent(null)).toBe('#7c3aed');
  });
});
