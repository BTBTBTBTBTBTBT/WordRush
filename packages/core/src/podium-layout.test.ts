import { describe, expect, it } from 'vitest';
import { podiumLayout, podiumOpenSpot, PODIUM_ART, PODIUM_ART_ORDER, podiumArtStep, CELEBRATION_STAGE } from './podium-layout';
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

describe('PODIUM_ART (one-image podium geometry; Swift/Kotlin mirror these numbers)', () => {
  it('steps are silver-left, gold-center (tallest), bronze-right', () => {
    expect(PODIUM_ART_ORDER).toEqual([2, 1, 3]);
    expect(PODIUM_ART.steps.map((s) => s.place)).toEqual([2, 1, 3]);
    expect(podiumArtStep(1).feet.y).toBeLessThan(podiumArtStep(2).feet.y);
    expect(podiumArtStep(1).feet.y).toBeLessThan(podiumArtStep(3).feet.y);
  });
  it('mirrors the approved numbers', () => {
    expect(PODIUM_ART.aspect).toBe(1.5);
    expect(podiumArtStep(2)).toMatchObject({ feet: { x: 0.22, y: 0.435 }, panel: { x0: 0.103, x1: 0.335, y0: 0.605, y1: 0.81 } });
    expect(podiumArtStep(1)).toMatchObject({ feet: { x: 0.5, y: 0.366 }, panel: { x0: 0.383, x1: 0.62, y0: 0.581, y1: 0.799 } });
    expect(podiumArtStep(3)).toMatchObject({ feet: { x: 0.783, y: 0.455 }, panel: { x0: 0.667, x1: 0.902, y0: 0.615, y1: 0.81 } });
  });
  it('every panel sits inside the image, under its step feet', () => {
    for (const s of PODIUM_ART.steps) {
      expect(s.panel.x1).toBeLessThan(1);
      expect(s.panel.y1).toBeLessThan(1);
      expect(s.panel.y0).toBeGreaterThan(s.feet.y);
      expect(s.feet.x).toBeGreaterThan(s.panel.x0);
      expect(s.feet.x).toBeLessThan(s.panel.x1);
    }
  });
});

describe('CELEBRATION_STAGE (Home Halloween card; Swift/Kotlin mirror these numbers)', () => {
  it('mirrors the approved pool centers', () => {
    expect(CELEBRATION_STAGE.feetX).toEqual([0.32, 0.5, 0.67]);
    expect(CELEBRATION_STAGE.footY).toBe(0.895);
    expect(CELEBRATION_STAGE.aspect).toBeCloseTo(1.6, 1);
  });
});
