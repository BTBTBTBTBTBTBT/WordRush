import { describe, expect, it } from 'vitest';
import { TRAY, TRAY_LOST, TRAY_WON, gameTrayStyle, trayColor, traySeam } from './game-tray';

describe('game tray (FINISH_SPEC L)', () => {
  it('washes in the accent, purple when won, slate when lost', () => {
    expect(trayColor('#ec4899')).toBe('#ec4899');
    expect(trayColor('#ec4899', 'won')).toBe(TRAY_WON);
    expect(trayColor('#ec4899', 'lost')).toBe(TRAY_LOST);
  });
  it('is rounded, padded, tinted (never plain white) with a lip and shadow', () => {
    const s = gameTrayStyle('#2563eb');
    expect(s.borderRadius).toBe(TRAY.radius);
    expect(s.padding).toBe(TRAY.padding);
    expect(s.paddingBottom).toBe(TRAY.padding + TRAY.lip);
    expect(String(s.background)).toContain('#2563eb1c');
    expect(String(s.background)).toContain('var(--color-card-base');
    expect(String(s.border)).toMatch(/^1\.5px solid #2563eb/);
    expect(String(s.boxShadow)).toContain(`inset 0 -${TRAY.lip}px 0`);
  });
  it('rings the active board', () => {
    const s = gameTrayStyle('#2563eb', { active: true });
    expect(s.border).toBe('2px solid #2563eb');
    expect(String(s.boxShadow)).toContain('0 0 0 3px #2563eb38');
  });
  it('draws seams in the tray color, never black', () => {
    expect(traySeam('#1e40af')).toMatch(/^#[0-9a-f]{8}$/);
    expect(traySeam('#1e40af')).not.toMatch(/^#000000/);
  });
});
