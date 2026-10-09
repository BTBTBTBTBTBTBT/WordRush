// ============================================================
// Share cards: the sender's mascot, big and posed by the result (FRIDAY-QUEUE item 46)
// ============================================================
// Every share image carries a HERO BAND under the title: the SENDER's own mascot (the real resolver's render, never a
// stand-in) large and celebrating, posed by the result: win = cheer + crown, flawless = jump on a gold glow, sweep =
// cheer + crown, loss = a good-sport shrug (no crown), everything else (a leaderboard, a profile, a streak) = a wave
// (a leaderboard's rank 1 cheers with the crown). The Halloween season swaps the glow to orange. The pose ids are the
// living mascot's (avatar-pose.ts AVATAR_POSES). Ported to ShareHero.swift / ShareHero.kt; share-hero-fixtures.json
// pins all three.
//
// Frames: the same card renders for iMessage (4:5 to 9:16, the default), an Instagram story (9:16) and a square (1:1).

export type ShareHeroResult =
  | 'win' | 'flawless' | 'sweep' | 'loss' | 'neutral'
  | 'rank1' | 'rank2' | 'rank3' | 'ranked';

export type ShareHeroPose = 'wave' | 'cheer' | 'jump' | 'shrug' | 'flex';

export interface ShareHeroSpec {
  pose: ShareHeroPose;
  /** The little 3D crown over the mascot's head. */
  crown: boolean;
  /** The glow behind the mascot (a soft radial, drawn in code). */
  glow: string;
  /** A gold ring (flawless). */
  gold: boolean;
}

export const SHARE_GLOW = {
  normal: '#A78BFA',
  gold: '#FCD34D',
  halloween: '#FB923C',
  sport: '#94A3B8',
} as const;

/** The hero for a result. `halloween` = the season skin is on (orange glow; gold stays gold). */
export function shareHeroSpec(result: ShareHeroResult, halloween: boolean): ShareHeroSpec {
  const base = halloween ? SHARE_GLOW.halloween : SHARE_GLOW.normal;
  switch (result) {
    case 'win': return { pose: 'cheer', crown: true, glow: base, gold: false };
    case 'flawless': return { pose: 'jump', crown: true, glow: SHARE_GLOW.gold, gold: true };
    case 'sweep': return { pose: 'cheer', crown: true, glow: base, gold: false };
    case 'loss': return { pose: 'shrug', crown: false, glow: SHARE_GLOW.sport, gold: false };
    case 'rank1': return { pose: 'cheer', crown: true, glow: halloween ? base : SHARE_GLOW.gold, gold: false };
    case 'rank2':
    case 'rank3': return { pose: 'cheer', crown: false, glow: base, gold: false };
    case 'ranked':
    case 'neutral': return { pose: 'wave', crown: false, glow: base, gold: false };
  }
}

/** A single / multi result's hero result from its win flag (flawless / sweep are set by the card that knows). */
export function shareHeroResultFor(won: boolean | null | undefined): ShareHeroResult {
  return won === true ? 'win' : won === false ? 'loss' : 'neutral';
}

/** A leaderboard row's rank as a hero result. */
export function shareHeroResultForRank(rank: number | null | undefined): ShareHeroResult {
  if (rank === 1) return 'rank1';
  if (rank === 2) return 'rank2';
  if (rank === 3) return 'rank3';
  return 'ranked';
}

// ── Frames ────────────────────────────────────────────────────────────────

export type ShareFrame = 'message' | 'story' | 'square';

/** Canvas height limits per frame (width is always 1080). 'message' is the long-standing 4:5 .. 9:16 clamp. */
export const SHARE_FRAMES: Record<ShareFrame, { minH: number; maxH: number }> = {
  message: { minH: 1350, maxH: 1920 },
  story: { minH: 1920, maxH: 1920 },
  square: { minH: 1080, maxH: 1080 },
};

/** The hero band's height (canvas px) and the gap under it; a square card has no room for one. */
export const SHARE_HERO_H = 300;
export const SHARE_HERO_GAP = 12;

/** Height the hero band adds to a card in `frame` (0 when it has none). */
export function shareHeroBand(frame: ShareFrame, hasHero: boolean): number {
  return hasHero && frame !== 'square' ? SHARE_HERO_H + SHARE_HERO_GAP : 0;
}
