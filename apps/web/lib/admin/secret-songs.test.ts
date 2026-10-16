import { describe, it, expect } from 'vitest';
import { MUSICAL_MELODIES, SEASON_MELODIES, SEASON_WINDOWS, type MusicalMelody } from '@wordle-duel/core';
import { ALWAYS_GROUP, castLetter, groupSecretSongs, secretSongGroups, secretSongView, type SecretSongSources } from './secret-songs';

const C4 = 60, D4 = 62, E4 = 64, G4 = 67;
const tune = (id: string, season?: string): MusicalMelody => ({ id, name: id, achievement: `tune_${id}`, source: '', hint: '', notes: [E4, D4, C4], ...(season ? { season } : {}) });
const ACH = [{ key: 'tune_a', name: 'A', description: 'Played A on the cast' }];
const base = (over: Partial<SecretSongSources> = {}): SecretSongSources => ({
  always: [tune('a')],
  bySeason: { halloween: [tune('h1')], thanksgiving: [] },
  windows: [
    { id: 'halloween', start: [10, 9], end: [10, 31], ready: true },
    { id: 'thanksgiving', start: [11, 14], end: [11, 29], ready: false },
  ],
  notePrefix: { halloween: 'note-h-' },
  label: (id) => id.toUpperCase(),
  achievements: ACH,
  ...over,
});

describe('groupSecretSongs', () => {
  it('Always first, then seasons in calendar order; a season with no tunes is hidden', () => {
    const g = groupSecretSongs(base());
    expect(g.map((x) => x.id)).toEqual([ALWAYS_GROUP, 'halloween']);
    expect(g[0]).toMatchObject({ title: 'Always', window: null, status: 'live', notePrefix: null });
    expect(g[1]).toMatchObject({ title: 'HALLOWEEN', window: 'Oct 9 – Oct 31', status: 'live', notePrefix: 'note-h-' });
  });

  it('a not-ready season is preview-only; a season without a window still gets its own group', () => {
    const g = groupSecretSongs(base({ bySeason: { thanksgiving: [tune('t1')], 'winter-holidays': [tune('w1')] } }));
    expect(g.map((x) => x.id)).toEqual([ALWAYS_GROUP, 'thanksgiving', 'winter-holidays']);
    expect(g[1]).toMatchObject({ window: 'Nov 14 – Nov 29', status: 'preview', notePrefix: null });
    expect(g[2]).toMatchObject({ title: 'WINTER-HOLIDAYS', window: null, status: 'preview' });
  });

  it("a tune's own optional season field wins over the batch it sits in", () => {
    const g = groupSecretSongs(base({ always: [tune('a'), tune('x', 'halloween')], bySeason: {} }));
    expect(g.map((x) => [x.id, x.songs.map((s) => s.id)])).toEqual([[ALWAYS_GROUP, ['a']], ['halloween', ['x']]]);
  });

  it('a song view carries the achievement, the hint fallback and the tap sequence as cast letters', () => {
    const v = secretSongView(tune('a'), ALWAYS_GROUP, ACH);
    expect(v.achievement).toEqual({ key: 'tune_a', name: 'A', description: 'Played A on the cast' });
    expect(v.hint).toBe('Played A on the cast');
    expect(v.source).toBeNull();
    expect(v.match.map((s) => `${s.letter}${s.note}`)).toEqual(['RE4', 'OD4', 'WC4']);
    expect(v.song.map((s) => s.beats)).toEqual([1, 1, 1]);
    expect(v.totalBeats).toBe(3);
  });

  it("core's source / hint are shown as-is; an empty hint falls back to the achievement, an unknown achievement is null", () => {
    const m: MusicalMelody = { ...tune('a'), source: 'Trad., 1848', hint: 'Try the lamb' };
    expect(secretSongView(m, ALWAYS_GROUP, ACH)).toMatchObject({ source: 'Trad., 1848', hint: 'Try the lamb' });
    expect(secretSongView({ ...tune('a'), notes: [G4] }, ALWAYS_GROUP, []).achievement).toBeNull();
  });

  it('every live tune carries a non-empty source and hint (core requires them)', () => {
    for (const g of secretSongGroups((id) => id)) for (const s of g.songs) {
      expect(s.source, s.id).toBeTruthy();
      expect(s.hint, s.id).toBeTruthy();
      expect(s.hint?.toLowerCase(), s.id).not.toContain(s.name.toLowerCase());
    }
  });

  it('castLetter: o1 / o2 / o3 are all O', () => {
    expect(['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'].map(castLetter).join('')).toBe('WORDOCIOUS');
  });
});

describe('the live catalog', () => {
  it('every core tune lands in exactly one group, every one with a secret achievement and a season in SEASON_WINDOWS', () => {
    const g = secretSongGroups((id) => id);
    const ids = g.flatMap((x) => x.songs.map((s) => s.id));
    const all = [...MUSICAL_MELODIES, ...Object.values(SEASON_MELODIES).flat()].map((m) => m.id);
    expect(ids.sort()).toEqual([...all].sort());
    expect(new Set(ids).size).toBe(ids.length);
    for (const grp of g) {
      for (const s of grp.songs) {
        expect(s.achievement, s.id).not.toBeNull();
        expect(s.match.length, s.id).toBeGreaterThan(0);
        expect(s.song.length, s.id).toBeGreaterThanOrEqual(s.match.length);
      }
      if (grp.id !== ALWAYS_GROUP) expect(SEASON_WINDOWS.some((w) => w.id === grp.id), grp.id).toBe(true);
    }
  });
});
