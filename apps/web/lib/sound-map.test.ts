import { describe, expect, it } from 'vitest';
import { readdirSync } from 'fs';
import path from 'path';
import { FEEDBACK, LAUGH_MIN_MS, MASTER_GAIN, SOUND_NAMES, TICK_MIN_MS, CLASSIC_SOUNDS, laughSound, noteSound, introSound, makeThrottle, scopedSound, revealFlipDelays, soundUrl, tapRate } from './sound-map';

describe('sound pack', () => {
  it('names exactly the shipped samples (the 16-sound pack + the Sound Lab picks)', () => {
    const files = readdirSync(path.resolve(__dirname, '../public/sounds')).filter((f) => f.endsWith('.m4a')).map((f) => f.replace(/\.m4a$/, '')).sort();
    expect([...SOUND_NAMES].sort()).toEqual(files);
    expect(SOUND_NAMES).toHaveLength(55);
    expect(SOUND_NAMES).toContain('intro');
    expect(soundUrl('tap')).toBe('/sounds/tap.m4a');
  });
  it('has a musical-cast note per hero (W O R D O C I O U S)', () => {
    expect(['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'].map((id) => noteSound(id))).toEqual(['note-w', 'note-o1', 'note-r', 'note-d', 'note-o2', 'note-c', 'note-i', 'note-o3', 'note-u', 'note-s']);
    expect(noteSound('zz')).toBeNull();
  });
  it('has the Halloween voicings: a spooky note per hero and the re-orchestrated intro (item 49)', () => {
    expect(['w', 'o1', 's'].map((id) => noteSound(id, `note-h-${id}`))).toEqual(['note-h-w', 'note-h-o1', 'note-h-s']);
    expect(noteSound('w', 'note-h-zz')).toBe('note-w');
    expect(introSound('intro-halloween')).toBe('intro-halloween');
    expect(introSound(null)).toBe('intro');
    expect(introSound('intro-nope')).toBe('intro');
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
    expect(FEEDBACK.levelup).toEqual({ sound: 'levelup', haptics: ['success'] });
    expect(FEEDBACK.open).toEqual({ sound: 'open', haptics: [] });
  });
  it('every sound in the map is a shipped sample', () => {
    for (const { sound } of Object.values(FEEDBACK)) if (sound) expect(SOUND_NAMES).toContain(sound);
  });
});

describe('Classic picks (sound scope)', () => {
  it('swaps only the listed sounds, only inside Classic', () => {
    expect(scopedSound('invalid', 'classic')).toBe('classic-invalid');
    expect(scopedSound('invalid', null)).toBe('invalid');
    expect(scopedSound('streak', 'classic')).toBe('classic-streak');
    expect(scopedSound('streak', null)).toBe('streak');
    expect(scopedSound('lose', 'classic')).toBe('classic-lose');
    expect(scopedSound('lose', null)).toBe('lose');
    expect(scopedSound('win', 'classic')).toBe('classic-win');
    expect(scopedSound('win', null)).toBe('win');
    expect(scopedSound('tap', 'classic')).toBe('tap');
    expect(scopedSound('flip', 'classic')).toBe('flip');
    expect(scopedSound('delete', 'classic')).toBe('delete');
    for (const v of Object.values(CLASSIC_SOUNDS)) expect(SOUND_NAMES).toContain(v);
  });
});

describe('cast giggles (Sound.castLaugh)', () => {
  it('maps every header hero to its own giggle', () => {
    for (const id of ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's']) expect(laughSound(id)).toBe(`laugh-${id}`);
    expect(laughSound('x')).toBeNull();
    expect(laughSound('')).toBeNull();
  });
  it('never machine-guns one hero (≥ 0.4 s, longer than a giggle)', () => {
    expect(LAUGH_MIN_MS).toBeGreaterThanOrEqual(400);
    const gate = makeThrottle(LAUGH_MIN_MS);
    let fired = 0;
    for (let t = 0; t < 1000; t += 50) if (gate(t)) fired++;
    expect(fired).toBe(2);
  });
});

describe('timing helpers', () => {
  it('staggers reveal flips by REVEAL.stagger', () => {
    expect(revealFlipDelays(5)).toEqual([0, 150, 300, 450, 600]);
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
