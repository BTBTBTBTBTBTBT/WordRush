import { describe, expect, it } from 'vitest';
import {
  SHARE_CARD_ORDER, SHARE_CHANNEL_AVAILABILITY, SHARE_CHANNEL_ORDER, shareSheetModel, type ShareCardKind, type SharePlatform, type ShareSheetContext,
  type ShareSurface,
} from './share-sheet';
import { SHARE_VARIANT_SUBTITLES } from './share-spoilers';

const PLATFORMS: SharePlatform[] = ['ios', 'android', 'web'];
const SURFACES: ShareSurface[] = ['finished', 'leaderboard', 'sweep', 'vs', 'profile', 'moment'];

const daily: ShareSheetContext = {
  surface: 'finished', mode: 'quordle', play: 'daily', cards: ['leaderboard', 'streak', 'result'], hasSpoilerVariant: true, season: null,
  caption: { kind: 'win', date: '2026-10-16', game: 'QuadWord', n: '8', t: '5:30', d: 5 },
};
const unlimited: ShareSheetContext = { ...daily, play: 'unlimited', cards: ['result'] };

describe('shareSheetModel edge cases (10-16)', () => {
  it('no season: no look swatches on any platform, for every surface (and "" / "normal" read as no season)', () => {
    for (const p of PLATFORMS) {
      for (const surface of SURFACES) {
        for (const season of [null, '', 'normal']) {
          const m = shareSheetModel({ ...daily, surface, cards: [], mode: surface === 'finished' ? 'quordle' : '', season }, p);
          expect(m.looks.shown, `${p} ${surface} ${season}`).toBe(false);
          expect(m.looks.options.map((o) => o.id), `${p} ${surface} ${season}`).toEqual(['normal']);
          expect(m.looks.initial).toBe('normal');
        }
      }
    }
  });

  it('a not-ready season id passed by the caller is still just a label (the caller gates readiness)', () => {
    const m = shareSheetModel({ ...daily, season: 'thanksgiving' }, 'ios');
    expect(m.looks).toEqual({ shown: true, options: [{ id: 'thanksgiving', label: 'Thanksgiving' }, { id: 'normal', label: 'Normal' }], initial: 'thanksgiving' });
  });

  it('unlimited vs daily: the carousel is exactly what the surface offers (unlimited has only its result card), in canonical order', () => {
    for (const p of PLATFORMS) {
      expect(shareSheetModel(daily, p).cards.map((c) => c.kind)).toEqual(['result', 'leaderboard', 'streak']);
      expect(shareSheetModel(unlimited, p).cards.map((c) => c.kind)).toEqual(['result']);
      // play never changes the toggle, the looks or the channels
      const d = shareSheetModel(daily, p), u = shareSheetModel(unlimited, p);
      expect(u.variant).toEqual(d.variant);
      expect(u.looks).toEqual(d.looks);
      expect(u.channels).toEqual(d.channels);
      expect(u.hiddenChannels).toEqual(d.hiddenChannels);
    }
  });

  it('an empty card list falls back to the surface default, every kind keeps the message frame and a title', () => {
    for (const surface of SURFACES) {
      const m = shareSheetModel({ ...daily, surface, cards: [] }, 'web');
      expect(m.cards.length).toBe(1);
      expect(SHARE_CARD_ORDER).toContain(m.cards[0].kind);
    }
    const all = shareSheetModel({ ...daily, cards: [...SHARE_CARD_ORDER].reverse() as ShareCardKind[] }, 'android');
    expect(all.cards.map((c) => c.kind)).toEqual([...SHARE_CARD_ORDER]);
    for (const c of all.cards) { expect(c.frame).toBe('message'); expect(c.title.length).toBeGreaterThan(0); }
    // duplicates in the context collapse to one tile each
    expect(shareSheetModel({ ...daily, cards: ['result', 'result', 'streak'] }, 'ios').cards.map((c) => c.kind)).toEqual(['result', 'streak']);
  });

  it('hidden (unregistered) channels are never in `channels`, on any platform or surface, and no id appears twice', () => {
    const hidden = SHARE_CHANNEL_ORDER.filter((id) => SHARE_CHANNEL_AVAILABILITY[id] === 'needsRegistration');
    expect(hidden).toEqual(['stories', 'snapchat', 'tiktok']);
    for (const p of PLATFORMS) {
      for (const surface of SURFACES) {
        for (const ctx of [daily, unlimited, { ...daily, caption: null, season: 'halloween' }]) {
          const m = shareSheetModel({ ...ctx, surface }, p);
          const ids = m.channels.map((c) => c.id);
          for (const h of hidden) expect(ids, `${p} ${surface}`).not.toContain(h);
          for (const c of m.hiddenChannels) expect(hidden).toContain(c.id);
          expect(new Set(ids).size).toBe(ids.length);
          expect(ids.filter((id) => m.hiddenChannels.some((h) => h.id === id))).toEqual([]);
          // the visible tiles keep the canonical left-to-right order
          const pos = ids.map((id) => SHARE_CHANNEL_ORDER.indexOf(id));
          expect([...pos].sort((a, b) => a - b)).toEqual(pos);
        }
      }
    }
  });

  it('the spoiler toggle copy covers every modeled puzzle mode and falls back to the colors / letters rule for word games', () => {
    for (const mode of Object.keys(SHARE_VARIANT_SUBTITLES)) {
      const m = shareSheetModel({ ...daily, mode, cards: ['result'] }, 'ios');
      expect(m.variant.shown).toBe(true);
      expect(m.variant.copy.clean.subtitle).toBe(SHARE_VARIANT_SUBTITLES[mode][0]);
      expect(m.variant.copy.full.subtitle).toBe(SHARE_VARIANT_SUBTITLES[mode][1]);
    }
    const word = shareSheetModel({ ...daily, mode: 'practice' }, 'web');
    expect(word.variant.copy.clean.subtitle).toBe('Colors only');
    expect(word.variant.copy.full.subtitle).toBe('Letters revealed');
    // a result card without a clean variant, or no result card at all: no toggle, but it still opens on clean
    expect(shareSheetModel({ ...daily, hasSpoilerVariant: false }, 'web').variant.shown).toBe(false);
    expect(shareSheetModel({ ...daily, cards: ['streak'] }, 'web').variant).toMatchObject({ shown: false, initial: 'clean' });
  });
});
