import { describe, it, expect } from 'vitest';
import { gameIdFor, planFor, seasonPicks, titleArtFor } from './art-preview';
import type { ArtAsset } from './art-library';

function asset(path: string, p: Partial<ArtAsset> = {}): ArtAsset {
  const parts = path.split('/');
  return {
    id: path.replace(/\.[a-z]+$/, ''), path, type: parts[0], kind: parts.length > 2 ? (parts[0] === 'seasons' ? parts[2] : parts[1]) : null,
    season: parts[0] === 'seasons' ? parts[1] : null, character: null, status: 'draft', stage: 'final', title: path, caption: null,
    width: 1024, height: 1024, mime: path.endsWith('.html') ? 'text/html' : 'image/png', bytes: 1, sha256: null,
    created_at: '2026-10-04T00:00:00Z', updated_at: '2026-10-04T00:00:00Z', decided_by: null, decided_at: null, note: null, ...p,
  };
}

describe('planFor', () => {
  it('puts a seasonal costume (and its alts) into the Home cast header as that cast member', () => {
    expect(planFor(asset('seasons/halloween/cast/w-alt1.png', { character: 'w' }))).toMatchObject({
      surface: 'home',
      swaps: [
        { key: 'mascot-w', assetId: 'seasons/halloween/cast/w-alt1', cast: 'w' },
        { key: 'art-halloween-w', assetId: 'seasons/halloween/cast/w-alt1', cast: 'w' },
      ],
    });
    expect(planFor(asset('characters/hero/o2.png', { character: 'o2' })).swaps[0].key).toBe('mascot-o2');
  });
  it('maps seasonal game titles by their lettered name', () => {
    expect(planFor(asset('seasons/halloween/titles/game-quadword.png'))).toMatchObject({ surface: 'game', game: 'quordle' });
    expect(planFor(asset('seasons/halloween/titles/game-classicsix.png')).game).toBe('six');
    expect(planFor(asset('titles/game/octordle.png')).swaps[0].key).toBe('art-game-octordle');
  });
  it('maps page titles, the Leaderboard title and day titles', () => {
    expect(planFor(asset('seasons/halloween/titles/page-friends.png'))).toMatchObject({ surface: 'title', titleArt: 'art-titlecast-friends' });
    expect(planFor(asset('seasons/halloween/titles/page-leaderboard.png')).surface).toBe('leaderboard');
    expect(planFor(asset('titles/days/friday.png'))).toMatchObject({ surface: 'leaderboard', titleArt: 'art-day-friday' });
    expect(planFor(asset('titles/inventory/solved.png')).titleArt).toBe('art-titlecast-solved');
  });
  it('maps wallpapers, button skins and labels, mascot parts and widgets', () => {
    expect(planFor(asset('wallpapers/wall-friends.png'))).toMatchObject({ surface: 'wallpaper', tint: 'friends', wall: 'art-wall-friends' });
    expect(planFor(asset('buttons/skins/gold-l-pressed.png'))).toMatchObject({ surface: 'buttons', buttonColor: 'gold' });
    expect(planFor(asset('buttons/labels/play.png')).swaps[0].key).toBe('art-btnlabel-play');
    expect(planFor(asset('mascot-maker/parts/art-av-eyes-happy.png'))).toMatchObject({ surface: 'mascot', part: { field: 'eyes', id: 'happy' } });
    expect(planFor(asset('widgets/2026-10-02/large-fresh-dark.png')).surface).toBe('widget');
  });
  it('falls back to none for unmapped art and non-images', () => {
    expect(planFor(asset('scenes/r-asleep.png')).surface).toBe('none');
    expect(planFor(asset('animation/cast.html')).surface).toBe('none');
    expect(planFor(asset('seasons/halloween/titles/label-boo.png')).surface).toBe('none');
  });
});

describe('helpers', () => {
  it('gameIdFor / titleArtFor', () => {
    expect(gameIdFor('classic')).toBe('practice');
    expect(gameIdFor('nope')).toBeNull();
    expect(titleArtFor('wordoftheday')).toBe('art-titlecast-wotd');
  });
});

describe('seasonPicks', () => {
  it('takes the approved costume, else the main one; never rejected or working files', () => {
    const lib = [
      asset('seasons/halloween/cast/w.png', { character: 'w' }),
      asset('seasons/halloween/cast/w-alt1.png', { character: 'w', status: 'approved' }),
      asset('seasons/halloween/cast/r.png', { character: 'r', status: 'rejected' }),
      asset('seasons/halloween/cast/r-alt1.png', { character: 'r' }),
      asset('seasons/halloween/cast/d.png', { character: 'd' }),
      asset('seasons/halloween/cast/d-alt1.png', { character: 'd' }),
      asset('seasons/halloween/raw/w.png', { stage: 'working' }),
      asset('seasons/thanksgiving/cast/w.png', { character: 'w', status: 'approved' }),
    ];
    const ids = seasonPicks(lib, 'halloween').map((a) => a.id).sort();
    expect(ids).toEqual(['seasons/halloween/cast/d', 'seasons/halloween/cast/r-alt1', 'seasons/halloween/cast/w-alt1']);
  });
});
