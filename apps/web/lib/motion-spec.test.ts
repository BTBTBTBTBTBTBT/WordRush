import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  MOTION, closeDurationMs, expoOut, liftedFrame, openDurationMs, openKind, revealTiming,
  riseStartFrame, shellTransform, usableSource, usesSoftPop, SYSTEM_SHEETS, FULL_SCREEN_GAMES,
} from './motion-spec';

// FINISH_SPEC BJ9 / BJ10 (iOS MotionSpecTests, Android MotionSpecTest).
const screen = { left: 0, top: 0, width: 390, height: 844 };
const card = { left: 16, top: 300, width: 174, height: 74 };

describe('BJ9 timing', () => {
  it('matches the approved demo', () => {
    expect(MOTION.liftScale).toBe(1.03);
    expect(MOTION.liftRise).toBe(4);
    expect(MOTION.liftMs).toBe(120);
    expect(MOTION.growMs).toBe(440);
    // the game fades in over the LAST 60% of the grow
    expect(revealTiming('grow')).toEqual({ delay: 120 + 176, duration: 264 });
    expect(openDurationMs('grow')).toBe(560);
    expect(closeDurationMs('grow')).toBe(180 + 380);
    for (const k of ['grow', 'rise', 'crossFade'] as const) expect(closeDurationMs(k)).toBeLessThan(600);
  });

  it('picks the open kind', () => {
    expect(openKind(true, false)).toBe('grow');
    expect(openKind(false, false)).toBe('rise');
    expect(openKind(true, true)).toBe('crossFade');
    expect(revealTiming('crossFade').delay).toBe(0);
  });
});

describe('BJ9 geometry', () => {
  it('lifts about the center and rises 4', () => {
    const l = liftedFrame(card);
    expect(l.width).toBeCloseTo(card.width * 1.03);
    expect(l.left + l.width / 2).toBeCloseTo(card.left + card.width / 2);
    expect(l.top + l.height / 2).toBeCloseTo(card.top + card.height / 2 - 4);
  });

  it('starts the soft rise smaller and lower', () => {
    const r = riseStartFrame(screen);
    expect(r.width).toBeCloseTo(screen.width * 0.96);
    expect(r.top + r.height / 2).toBeCloseTo(screen.height / 2 + 14);
  });

  it('only grows from a card that is on screen', () => {
    expect(usableSource(null, screen)).toBeNull();
    expect(usableSource({ left: 0, top: 0, width: 0, height: 0 }, screen)).toBeNull();
    expect(usableSource({ ...card, top: 2000 }, screen)).toBeNull();
    expect(usableSource(card, screen)).toEqual(card);
  });

  it('maps the full-screen shell onto a card', () => {
    expect(shellTransform(screen, screen)).toBe('translate(0px, 0px) scale(1, 1)');
    expect(shellTransform(card, screen)).toBe(`translate(16px, 300px) scale(${174 / 390}, ${74 / 844})`);
    expect(expoOut(0)).toBe(0);
    expect(expoOut(1)).toBe(1);
    expect(expoOut(0.4)).toBeGreaterThan(0.9);
  });
});

describe('BJ10 soft pop', () => {
  it('keeps system sheets native', () => {
    for (const k of SYSTEM_SHEETS) expect(usesSoftPop(k)).toBe(false);
    expect(usesSoftPop(FULL_SCREEN_GAMES)).toBe(false);
    for (const k of ['help', 'settings', 'streak', 'shield', 'guide', 'strategy', 'wotd', 'profile', 'records', 'vs', 'pro', 'friend', 'pocketGame', 'achievements']) {
      expect(usesSoftPop(k)).toBe(true);
    }
    expect(MOTION.popScale).toBe(0.94);
    expect(MOTION.popDismissMs).toBeLessThan(MOTION.popMs);
  });

  it('pops every shared dialog / sheet from the bottom center', () => {
    for (const f of ['dialog.tsx', 'alert-dialog.tsx', 'sheet.tsx']) {
      const src = readFileSync(join(__dirname, '../components/ui', f), 'utf8');
      expect(src, f).toContain('zoom-in-[0.94]');
      expect(src, f).toContain('origin-bottom');
      expect(src, f).not.toContain('slide-in-from-bottom');
    }
    const css = readFileSync(join(__dirname, '../app/globals.css'), 'utf8');
    expect(css).toContain('.animate-modal-content { transform-origin: 50% 100%; }');
    expect(css).toMatch(/\.soft-pop \{[^}]*transform-origin: 50% 100%/);
  });
});
