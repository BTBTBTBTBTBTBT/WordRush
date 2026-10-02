import { describe, expect, it } from 'vitest';
import { readdirSync } from 'fs';
import path from 'path';
import { FEEDBACK, MASTER_GAIN, SOUND_NAMES, TICK_MIN_MS, makeThrottle, revealFlipDelays, soundUrl, tapRate } from './sound-map';

describe('sound pack', () => {
  it('names exactly the 16 shipped samples', () => {
    const files = readdirSync(path.resolve(__dirname, '../public/sounds')).filter((f) => f.endsWith('.m4a')).map((f) => f.replace(/\.m4a$/, '')).sort();
    expect([...SOUND_NAMES].sort()).toEqual(files);
    expect(SOUND_NAMES).toHaveLength(16);
    expect(soundUrl('tap')).toBe('/sounds/tap.m4a');
  });
  it('plays at ~0.6 master volume', () => {
    expect(MASTER_GAIN).toBeCloseTo(0.6);
  });
  it('jitters tap pitch within ±3%', () => {
    expect(tapRate(0)).toBeCloseTo(0.97);
    expect(tapRate(0.5)).toBeCloseTo(1);
    expect(tapRate(0.999999)).toBeCloseTo(1.03);
    expect(tapRate(-5)).toBeCloseTo(0.97);
    expect(tapRate(7)).toBeCloseTo(1.03);
  });
});

describe('event map (FINISH_SPEC U)', () => {
  it('matches the spec', () => {
    expect(FEEDBACK.key).toEqual({ sound: 'tap', haptics: ['light'] });
    expect(FEEDBACK.delete).toEqual({ sound: 'delete', haptics: ['light'] });
    expect(FEEDBACK.flip).toEqual({ sound: 'flip', haptics: ['selection'] });
    expect(FEEDBACK.rowLand).toEqual({ sound: null, haptics: ['light'] });
    expect(FEEDBACK.invalid).toEqual({ sound: 'invalid', haptics: ['warning'] });
    expect(FEEDBACK.press).toEqual({ sound: 'press', haptics: ['soft'] });
    expect(FEEDBACK.release).toEqual({ sound: 'release', haptics: [] });
    expect(FEEDBACK.hop).toEqual({ sound: 'hop', haptics: [] });
    expect(FEEDBACK.win).toEqual({ sound: 'win', haptics: ['success'] });
    expect(FEEDBACK.lose).toEqual({ sound: 'lose', haptics: ['soft'] });
    expect(FEEDBACK.celebrate).toEqual({ sound: 'celebrate', haptics: ['success', 'heavy'] });
    expect(FEEDBACK.streak).toEqual({ sound: 'streak', haptics: ['medium'] });
    expect(FEEDBACK.tick).toEqual({ sound: 'tick', haptics: [] });
    expect(FEEDBACK.notify).toEqual({ sound: 'notify', haptics: ['light'] });
    expect(FEEDBACK.unlock).toEqual({ sound: 'unlock', haptics: ['success'] });
    expect(FEEDBACK.vs).toEqual({ sound: 'vs', haptics: ['medium'] });
    expect(FEEDBACK.whoosh).toEqual({ sound: 'whoosh', haptics: [] });
  });
  it('every sound in the map is a shipped sample', () => {
    for (const { sound } of Object.values(FEEDBACK)) if (sound) expect(SOUND_NAMES).toContain(sound);
  });
});

describe('timing helpers', () => {
  it('staggers reveal flips by REVEAL.stagger', () => {
    expect(revealFlipDelays(5)).toEqual([0, 70, 140, 210, 280]);
    expect(revealFlipDelays(0)).toEqual([]);
  });
  it('throttles ticks to ≤12 a second', () => {
    const gate = makeThrottle(TICK_MIN_MS);
    let fired = 0;
    for (let t = 0; t < 1000; t += 16) if (gate(t)) fired++;
    expect(fired).toBeLessThanOrEqual(12);
    expect(fired).toBeGreaterThanOrEqual(10);
  });
});
