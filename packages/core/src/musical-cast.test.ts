import { describe, it, expect } from 'vitest';
import {
  HALLOWEEN_MELODIES, HALLOWEEN_TUNES_TODO, activeMelodies, melodyIntervals, MELODY_GAP_MS, MELODY_START, MUSICAL_ACHIEVEMENT_KEYS, MUSICAL_CAST_FLAG, MUSICAL_CAST_IDS, MUSICAL_MELODIES, MUSICAL_SCALE, matchMelody, melodyTap,
  midiNoteName, musicalCastEnabled, musicalNote, musicalTransformDelays, musicalTransformDuration, type MelodyState,
} from './musical-cast';
import { NEW_ACHIEVEMENTS, SECRET_ACHIEVEMENT_KEYS, achievementListed } from './achievement-rules';

/** Play cast ids at 300 ms apart; returns every tap's match id (null when none). */
function play(ids: readonly string[], start: MelodyState = MELODY_START, t0 = 1000) {
  let s = start;
  return ids.map((id, i) => { const r = melodyTap(s, id, t0 + i * 300); s = r.state; return r.matched?.id ?? null; });
}
const idFor = (midi: number) => MUSICAL_CAST_IDS[MUSICAL_SCALE.indexOf(midi as (typeof MUSICAL_SCALE)[number])];

describe('the flag', () => {
  it('on in debug, off in release', () => {
    expect(MUSICAL_CAST_FLAG).toEqual({ debug: true, release: false });
    expect(musicalCastEnabled(true)).toBe(true);
    expect(musicalCastEnabled(false)).toBe(false);
  });
});

describe('the note map', () => {
  it('W O R D O C I O U S = C4 D4 E4 F4 G4 A4 B4 C5 D5 E5', () => {
    expect(MUSICAL_CAST_IDS.map((id) => musicalNote(id)!.name)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5']);
    expect(musicalNote('o2')).toEqual({ castId: 'o2', index: 4, midi: 67, name: 'G4', sound: 'note-o2' });
    expect(musicalNote('x')).toBeNull();
  });
  it('the scale is in key: whole, whole, half, whole, whole, whole, half, whole, whole', () => {
    expect(MUSICAL_SCALE.slice(1).map((m, i) => m - MUSICAL_SCALE[i])).toEqual([2, 2, 1, 2, 2, 2, 1, 2, 2]);
    expect(midiNoteName(61)).toBe('C#4');
    expect(midiNoteName(48)).toBe('C3');
  });
});

describe('the transform', () => {
  it('ripples out from the pressed character', () => {
    expect(musicalTransformDelays('w', false)).toEqual([0, 55, 110, 165, 220, 275, 330, 385, 440, 495]);
    expect(musicalTransformDelays('o2', false)).toEqual([220, 165, 110, 55, 0, 55, 110, 165, 220, 275]);
    expect(musicalTransformDuration('w', false)).toBe(495 + 420);
  });
  it('Reduce Motion = an instant swap', () => {
    expect(musicalTransformDelays('c', true)).toEqual(Array(10).fill(0));
    expect(musicalTransformDuration('c', true)).toBe(0);
  });
});

describe('the melody matcher', () => {
  for (const m of MUSICAL_MELODIES) {
    it(`${m.name}: every note is on a cast key; only its last note completes it`, () => {
      for (const n of m.notes) expect(MUSICAL_SCALE).toContain(n);
      const hits = play(m.notes.map(idFor));
      expect(hits.slice(0, -1).every((h) => h === null)).toBe(true);
      expect(hits[hits.length - 1]).toBe(m.id);
    });
  }
  it('a wrong note anywhere spoils it', () => {
    const m = MUSICAL_MELODIES[0];
    const wrong = [...m.notes]; wrong[5] = 76;
    expect(matchMelody(wrong)).toBeNull();
    expect(matchMelody(m.notes.slice(1))).toBeNull();
  });
  it('noodling first is fine (the tune only has to END the phrase)', () => {
    const twinkle = MUSICAL_MELODIES.find((m) => m.id === 'twinkle')!;
    expect(play(['s', 'u', 'i', ...twinkle.notes.map(idFor)]).pop()).toBe('twinkle');
  });
  it('another key counts when it fits on the cast (Twinkle in G)', () => {
    const twinkle = MUSICAL_MELODIES.find((m) => m.id === 'twinkle')!;
    expect(matchMelody(twinkle.notes.map((n) => n + 7))).toBe(twinkle);
    expect(play(twinkle.notes.map((n) => idFor(n + 7))).pop()).toBe('twinkle');
  });
  it('a long pause starts a fresh phrase', () => {
    const mary = MUSICAL_MELODIES.find((m) => m.id === 'mary')!;
    const ids = mary.notes.map(idFor);
    let s = MELODY_START;
    ids.forEach((id, i) => { s = melodyTap(s, id, i * 300 + (i >= 6 ? MELODY_GAP_MS + 1 : 0)).state; });
    expect(s.notes.length).toBe(mary.notes.length - 6);
  });
  it('the buffer clears after a match, so a tune fires once', () => {
    const buns = MUSICAL_MELODIES.find((m) => m.id === 'buns')!;
    let s = MELODY_START;
    let last = null as ReturnType<typeof melodyTap> | null;
    buns.notes.map(idFor).forEach((id, i) => { last = melodyTap(s, id, i * 200); s = last.state; });
    expect(last!.matched?.id).toBe('buns');
    expect(s.notes).toEqual([]);
    expect(melodyTap(s, 'r', 4000).matched).toBeNull();
  });
  it('unknown ids are ignored', () => {
    expect(melodyTap(MELODY_START, 'zz', 0)).toEqual({ state: MELODY_START, note: null, matched: null });
  });
});

describe('the secret achievements', () => {
  it('each tune unlocks its own secret entry in the existing catalog', () => {
    expect(SECRET_ACHIEVEMENT_KEYS).toEqual(MUSICAL_ACHIEVEMENT_KEYS);
    for (const k of MUSICAL_ACHIEVEMENT_KEYS) {
      const a = NEW_ACHIEVEMENTS.find((x) => x.key === k)!;
      expect(a.secret).toBe(true);
      expect(a.hidden).toBeUndefined();
    }
  });
  it('a secret is listed only once unlocked; hidden never; others always', () => {
    const lamb = NEW_ACHIEVEMENTS.find((x) => x.key === 'tune_little_lamb')!;
    expect(achievementListed(lamb, new Set())).toBe(false);
    expect(achievementListed(lamb, new Set(['tune_little_lamb']))).toBe(true);
    expect(achievementListed({ key: 'under_par', hidden: true }, new Set(['under_par']))).toBe(false);
    expect(achievementListed({ key: 'first_win' }, new Set())).toBe(true);
  });
});

describe('the Halloween tunes (item 49)', () => {
  const idForNote = (midi: number) => MUSICAL_CAST_IDS[MUSICAL_SCALE.indexOf(midi as (typeof MUSICAL_SCALE)[number])];
  const playSeason = (notes: readonly number[], season: string | null) => {
    let st: MelodyState = MELODY_START;
    return notes.map((n, i) => { const r = melodyTap(st, idForNote(n), 1000 + i * 300, season); st = r.state; return r.matched?.id ?? null; });
  };
  it('every Halloween tune sits on the cast keys, and has its own secret achievement', () => {
    for (const m of HALLOWEEN_MELODIES) {
      for (const n of m.notes) expect(MUSICAL_SCALE).toContain(n);
      expect(MUSICAL_ACHIEVEMENT_KEYS).toContain(m.achievement);
      expect(SECRET_ACHIEVEMENT_KEYS).toContain(m.achievement);
    }
  });
  it('the Mountain King is the right shape (2 1 2 2 -4 4 -2 -3 3)', () => {
    expect(melodyIntervals(HALLOWEEN_MELODIES[0].notes)).toEqual([2, 1, 2, 2, -4, 4, -2, -3, 3]);
  });
  it('unlocks only in season; the everyday tunes still work in season', () => {
    for (const m of HALLOWEEN_MELODIES) {
      expect(playSeason(m.notes, 'halloween').pop()).toBe(m.id);
      expect(playSeason(m.notes, null).pop()).not.toBe(m.id);
      expect(playSeason(m.notes, 'valentines').pop()).not.toBe(m.id);
    }
    expect(playSeason(MUSICAL_MELODIES[0].notes, 'halloween').pop()).toBe('mary');
  });
  it('in season each note has its spooky voicing (note-h-<id>); out of season the normal voice', () => {
    expect(musicalNote('w', 'halloween')!.sound).toBe('note-h-w');
    expect(musicalNote('w', 'valentines')!.sound).toBe('note-w');
    expect(musicalNote('w')!.sound).toBe('note-w');
    expect(activeMelodies(null)).toHaveLength(MUSICAL_MELODIES.length);
    expect(activeMelodies('halloween')).toHaveLength(MUSICAL_MELODIES.length + HALLOWEEN_MELODIES.length);
  });
  it('no copyrighted Halloween songs are named anywhere', () => {
    const text = JSON.stringify([HALLOWEEN_MELODIES, HALLOWEEN_TUNES_TODO]).toLowerCase();
    for (const bad of ['monster mash', 'ghostbusters', 'thriller', 'this is halloween', 'addams']) expect(text).not.toContain(bad);
  });
});
