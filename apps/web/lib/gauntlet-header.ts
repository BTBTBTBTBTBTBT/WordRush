/**
 * The Gauntlet header (night art 10-03): `art-gauntlet-header` — the GAUNTLET lettering over a gold
 * track of five silver sockets — with one medallion per stage set into its socket:
 * `art-gauntlet-medal-cleared` (gold + star), `-current` (orange, white stage numeral) and `-locked`
 * (silver, slate numeral). Socket centers + diameters come from
 * docs/design/brand/gauntlet/header-slots.json (x, d: fractions of the header WIDTH; y: of its
 * HEIGHT). Mirrors iOS GauntletHeaderSpec (Core) and Android GauntletHeaderSpec (keep in step).
 */
export const GAUNTLET_HEADER = {
  /** art-gauntlet-header's aspect (1200 × 416; the 1899 × 659 source). */
  aspect: 1200 / 416,
  /**
   * Drawn height: it replaces the old stepper row (≈26) AND the stage-name title row (≈25),
   * so the board does not move down; the stage name rides the status line under it.
   */
  height: 52,
  /** A medallion draws at 1.18 × the socket's inner diameter (header-slots.json note). */
  medalScale: 1.18,
  /** The stage numeral's size as a fraction of the medallion. */
  numeralScale: 0.5,
  slots: [
    { x: 0.1193, y: 0.7678, d: 0.1343 },
    { x: 0.3115, y: 0.7693, d: 0.1327 },
    { x: 0.5016, y: 0.7693, d: 0.1327 },
    { x: 0.6914, y: 0.7701, d: 0.1332 },
    { x: 0.8826, y: 0.7701, d: 0.1332 },
  ],
} as const;

export type MedalState = 'cleared' | 'current' | 'locked';

/** Each stage's medallion: cleared if it has a result, current if it is the stage in play, else locked. */
export function medalStates(stageCount: number, currentStage: number, clearedStages: Iterable<number>): MedalState[] {
  const cleared = new Set(clearedStages);
  return Array.from({ length: stageCount }, (_, i) => (cleared.has(i) ? 'cleared' : i === currentStage ? 'current' : 'locked'));
}

/** Where medallion `i` draws, as fractions of the header box: center (cx, cy) and size (w, h). */
export function medalBox(i: number, aspect: number = GAUNTLET_HEADER.aspect) {
  const s = GAUNTLET_HEADER.slots[i];
  const w = s.d * GAUNTLET_HEADER.medalScale;
  return { cx: s.x, cy: s.y, w, h: w * aspect };
}

/** The header's accessible label: "Gauntlet, stage 3 of 5, Succession". */
export function gauntletHeaderLabel(currentStage: number, stageCount: number, stageName: string): string {
  const n = Math.min(currentStage + 1, stageCount);
  return `Gauntlet, stage ${n} of ${stageCount}, ${stageName}`;
}
