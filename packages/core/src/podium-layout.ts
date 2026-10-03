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
