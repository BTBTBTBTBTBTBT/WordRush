import { describe, expect, it } from 'vitest';
import { podiumLayout, podiumOpenSpot } from './podium-layout';
import { resolveAvatar, isCustomPhotoUrl } from './avatar-config';

describe('podiumLayout (BJ4: podium on every board from one result)', () => {
  it('stands one result with two open spots', () => expect(podiumLayout([1])).toEqual({ filled: 1, open: [2, 3] }));
  it('stands two results with one open spot', () => expect(podiumLayout([1, 2])).toEqual({ filled: 2, open: [3] }));
  it('a full podium has no open spots; rows after list below', () => expect(podiumLayout([1, 2, 3, 4])).toEqual({ filled: 3, open: [] }));
  it('ties share steps', () => expect(podiumLayout([1, 1, 3, 4])).toEqual({ filled: 3, open: [] }));
  it('an empty board has no podium', () => expect(podiumLayout([])).toEqual({ filled: 0, open: [] }));
  it('open spot copy', () => expect(podiumOpenSpot(3)).toEqual({ title: 'Open spot', line: 'Claim #3' }));
});

describe('resolveAvatar (BJ5: one precedence everywhere)', () => {
  const up = 'https://x.supabase.co/storage/v1/object/public/avatars/u/avatar.jpg';
  const g = 'https://lh3.googleusercontent.com/a/abc';
  it('custom photo when display = photo', () => {
    expect(resolveAvatar({ username: 'BMT', avatarUrl: up, config: { body: 'star', display: 'photo' } })).toMatchObject({ kind: 'photo', photoUrl: up });
  });
  it('saved mascot beats the photo when display = mascot', () => {
    expect(resolveAvatar({ username: 'BMT', avatarUrl: up, config: { body: 'star', display: 'mascot' } })).toMatchObject({ kind: 'config', photoUrl: null });
  });
  it('an uploaded photo with no saved config shows', () => expect(resolveAvatar({ username: 'a', avatarUrl: up }).kind).toBe('photo'));
  it('an OAuth picture with no saved choice never shows (no plain letter tiles)', () => {
    expect(resolveAvatar({ username: 'Ukrainian Cyclone', avatarUrl: g }).kind).toBe('seeded');
    expect(isCustomPhotoUrl(g)).toBe(false);
  });
  it('cast hero, then seeded; the frame fills a frameless config', () => {
    expect(resolveAvatar({ username: 'd', castId: 'R', frame: 'gold' })).toMatchObject({ kind: 'cast', config: { frame: 'gold' } });
    expect(resolveAvatar({ username: 'd' }).kind).toBe('seeded');
  });
});
