import { darken, softMix } from './soft-surface';

/**
 * FINISH_SPEC BH1: the Home game card's candy cap trim — ONE shape per card: a slim glossy band
 * across the card's top whose bottom edge is a row of shallow frosting drips. Mirrored by
 * iOS CardTrim (ModeCardView.swift) and Android CardTrimShape (ModeCardView.kt); keep the three in step.
 *
 * Measures are in card units (px / pt / dp): `band` is the solid band, `drip` how far each
 * drip hangs below it, `bumps` the drips across a card (≈ one per 22 units of a phone card).
 */
export const TRIM = { band: 9, drip: 4, bumps: 8, viewW: 176 } as const;

/** The trim's outline for a card `w` wide: top edge, sides down to the band, then the drips right → left. */
export function trimPath(w: number = TRIM.viewW, band: number = TRIM.band, drip: number = TRIM.drip, bumps: number = TRIM.bumps): string {
  const bw = w / bumps;
  const r = (n: number) => Math.round(n * 100) / 100;
  let d = `M0 0H${r(w)}V${band}`;
  // A quadratic with its control point 2·drip below the band peaks exactly `drip` below it.
  for (let i = bumps - 1; i >= 0; i--) d += `Q${r((i + 0.5) * bw)} ${band + 2 * drip} ${r(i * bw)} ${band}`;
  return `${d}Z`;
}

/** The candy gradient, top → bottom: a light glossy lip (the baked-in highlight), the accent, a deeper base. */
export function trimStops(accent: string, locked = false): [number, string][] {
  if (locked) return [[0, '#e5e7eb'], [1, '#c9ced6']];
  return [[0, softMix(accent, 0.45)], [0.42, accent], [1, darken(accent, 0.14)]];
}

/**
 * BH2 (founder 10-03): a card's subtitle stays ONE line. A result line that runs long
 * ("38 guesses · 10m 46s", Gauntlet) takes the short form ("38g · 10m 46s") instead of wrapping.
 */
export const CARD_LINE_MAX = 16;

export function compactCardLine(line: string, max: number = CARD_LINE_MAX): string {
  if (line.length <= max) return line;
  return line
    .replace(/(\d+) guess(es)?\b/g, '$1g')
    .replace(/(\d+) mistakes?\b/g, '$1 miss')
    .replace(/(\d+) checks?\b/g, '$1 chk')
    .replace(/(\d+) miss(es)?\b/g, '$1 miss');
}
