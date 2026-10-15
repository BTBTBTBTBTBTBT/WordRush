// FINISH_SPEC BJ4 (founder 10-03: "The podium only appears on classic right
// now"): every board — each game, Everyone and Friends, Sweep, Puzzles — stands
// its leaders on the podium as soon as ONE result is in. The podium takes the
// leading rows ranked within the top three (ties share a step: 1, 1, 3), at most
// three; the places still free show as open spots (a dimmed step with a sleepy
// cast member and "Open spot · Claim #N"). Rows after the podium list below it.

export const PODIUM_SIZE = 3;

export interface PodiumLayout {
  /** How many leading rows stand on the podium (0 = no podium: an empty board). */
  filled: number;
  /** The places (2, 3) still free — drawn as open spots. Empty when the podium is full. */
  open: number[];
}

/** Splits a board by its competition ranks (score desc order) into podium + open spots. */
export function podiumLayout(ranks: readonly number[], size = PODIUM_SIZE): PodiumLayout {
  let filled = 0;
  while (filled < ranks.length && filled < size && ranks[filled] <= size) filled++;
  if (filled === 0) return { filled: 0, open: [] };
  const open: number[] = [];
  for (let i = filled; i < size; i++) open.push(i + 1);
  return { filled, open };
}

/** The open spot's two lines (parity copy). */
export function podiumOpenSpot(place: number): { title: string; line: string } {
  return { title: 'Open spot', line: `Claim #${place}` };
}

// 2.8 one-image podium (founder 10-15): ONE stadium image (1536x1024) replaces the three podium blocks and
// the per-player stat cards. Every renderer (web / iOS / Android) lays the image across the podium area
// (height = width / aspect), stands each mascot with its feet on the step-top center, and prints the stats
// INSIDE the blank panel under each step's number. All numbers are fractions of the image (x of width,
// y of height); the parity fixture (podium-layout-fixtures.json "art") keeps the ports identical.
export interface PodiumArtPoint { x: number; y: number }
export interface PodiumArtPanel { x0: number; x1: number; y0: number; y1: number }
export interface PodiumArtStep { place: 1 | 2 | 3; feet: PodiumArtPoint; panel: PodiumArtPanel }

export const PODIUM_ART = {
  /** Image width / height (1536 x 1024). */
  aspect: 1.5,
  /** Mascot lands this many points lower than the step-top center so it looks planted. */
  plantPt: 5,
  /** Name label floats this many points above the mascot. */
  nameGapPt: 8,
  /** Contact shadow ellipse width as a fraction of the mascot width. */
  shadowWidth: 0.9,
  /** Panel text: the score line and the two detail lines, as fractions of the panel height. */
  scoreHeight: 0.29,
  detailHeight: 0.19,
  /** Dark purple on all three light satin panels: rgb(70, 30, 100). */
  textRgb: [70, 30, 100] as const,
  /** Left-to-right on screen: silver (2), gold (1), bronze (3). */
  steps: [
    { place: 2, feet: { x: 0.220, y: 0.435 }, panel: { x0: 0.103, x1: 0.335, y0: 0.605, y1: 0.810 } },
    { place: 1, feet: { x: 0.500, y: 0.366 }, panel: { x0: 0.383, x1: 0.620, y0: 0.581, y1: 0.799 } },
    { place: 3, feet: { x: 0.783, y: 0.455 }, panel: { x0: 0.667, x1: 0.902, y0: 0.615, y1: 0.810 } },
  ] as readonly PodiumArtStep[],
} as const;

/** Screen order (left to right) of the places on the podium art: 2, 1, 3. */
export const PODIUM_ART_ORDER: readonly (1 | 2 | 3)[] = [2, 1, 3];

/** The art step for a place (1..3). */
export function podiumArtStep(place: 1 | 2 | 3): PodiumArtStep {
  return PODIUM_ART.steps.find((s) => s.place === place)!;
}

// 2.8 Home celebration card (founder 10-15, Halloween season only): art-celebration-stage-halloween (1586x992) is drawn
// cover-fit behind the Home banner's stage (title + toggle + countdown + the animated cast trio). The art's own coral
// valance and curtains replace the card's drawn cap / backdrop while it shows. The trio's FEET land in the three spotlight
// pools: x = feetX of the card width, y = footY of the card height.
export const CELEBRATION_STAGE = {
  /** Image width / height (1586 x 992). */
  aspect: 1586 / 992,
  /** Spotlight pool centers, left to right, as fractions of the card width. */
  feetX: [0.32, 0.5, 0.67] as readonly number[],
  /** The pools' y as a fraction of the card height. */
  footY: 0.895,
} as const;
