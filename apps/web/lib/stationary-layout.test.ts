import { describe, expect, it } from 'vitest';
import {
  BANNER_SLOT, MODE_SWITCH, homeBannerContent, homeBannerSlots, modeCardSlots, modeSwitchLayout,
  type BannerInput, type FrameTier,
} from './stationary-layout';

// FINISH_SPEC Z: toggling Daily ⇄ Unlimited never moves the tiles / cards.

const TIERS: FrameTier[] = ['none', 'sweep', 'flawless'];
const INPUTS: BannerInput[] = TIERS.flatMap((dailyTier) => TIERS.flatMap((puzzleTier) =>
  [true, false].map((playedAny) => ({ dailyTier, puzzleTier, playedAny }))));

describe('home banner slots', () => {
  it('are identical in Daily and Unlimited for every day state', () => {
    for (const input of INPUTS) {
      expect(homeBannerSlots('unlimited', input)).toEqual(homeBannerSlots('daily', input));
    }
  });

  it('put the tiles at the same top in both modes', () => {
    for (const input of INPUTS) {
      const d = homeBannerSlots('daily', input);
      const u = homeBannerSlots('unlimited', input);
      expect(u.wordTilesTop).toBe(d.wordTilesTop);
      expect(u.puzzleTilesTop).toBe(d.puzzleTilesTop);
      expect(u.height).toBe(d.height);
    }
  });

  it('reserve the share and headline slots even when empty', () => {
    const s = homeBannerSlots('unlimited', { dailyTier: 'none', puzzleTier: 'none', playedAny: false });
    expect(s.shareWidth).toBe(BANNER_SLOT.share);
    expect(s.headline).toBe(BANNER_SLOT.headline);
    expect(s.headerRow).toBeGreaterThanOrEqual(BANNER_SLOT.share);
  });

  it('keep the art frame on a swept day in Unlimited, filled with the U loop', () => {
    const input: BannerInput = { dailyTier: 'sweep', puzzleTier: 'none', playedAny: true };
    expect(homeBannerSlots('unlimited', input).frame).toBe('art');
    expect(homeBannerContent('daily', input)).toMatchObject({ art: 'tier', topBar: 'sweep', showShare: true, wordTier: 'sweep' });
    expect(homeBannerContent('unlimited', input)).toMatchObject({ art: 'loop', topBar: 'unlimited', showShare: false, wordTier: 'none', showStreaks: false });
  });

  it('show the trophy only on a Daily double flawless', () => {
    const input: BannerInput = { dailyTier: 'flawless', puzzleTier: 'flawless', playedAny: true };
    expect(homeBannerContent('daily', input).showTrophy).toBe(true);
    expect(homeBannerContent('unlimited', input).showTrophy).toBe(false);
  });
});

describe('mode switch', () => {
  it('keeps segment widths fixed; only the thumb moves', () => {
    for (const locked of [false, true]) {
      const d = modeSwitchLayout('daily', { locked });
      const u = modeSwitchLayout('unlimited', { locked });
      expect(u.daily).toEqual(d.daily);
      expect(u.unlimited).toEqual(d.unlimited);
      expect(u.width).toBe(d.width);
      expect(u.height).toBe(d.height);
      expect(d.thumb).toEqual(d.daily);
      expect(u.thumb).toEqual(u.unlimited);
    }
  });

  it('gives the locked UNLIMITED segment room for the PRO pill', () => {
    expect(modeSwitchLayout('daily', { locked: true }).unlimited.width).toBe(MODE_SWITCH.unlimited + MODE_SWITCH.proPill);
  });
});

describe('mode card slots', () => {
  it('are identical in Daily and Unlimited', () => {
    expect(modeCardSlots('unlimited')).toEqual(modeCardSlots('daily'));
    expect(modeCardSlots('daily').descHeight).toBe(16); // BH2: one subtitle line
    expect(modeCardSlots('daily').textHeight).toBeLessThanOrEqual(42); // fits beside the icon
  });
});
