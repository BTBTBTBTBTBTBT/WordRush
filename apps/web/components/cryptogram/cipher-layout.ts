// Codebreaker board sizing (More Games §16, founder layout rule 2026-09-24):
// the cipher board and the frequency strip are one block centered in the band
// between the header and the Delete · Check · Hint · Reveal row. The cell side
// starts at 64px and steps down 4px at a time until the whole cipher, wrapped
// word by word at the band's width, fits the band's height together with the
// strip; floor 40px. Everything here is pure so the wrap and the fit can be
// unit-tested, and so the board draws exactly the lines the fit measured.

export const CIPHER_CELL_MAX = 64;
export const CIPHER_CELL_MIN = 40;
export const CIPHER_CELL_STEP = 4;

/** Gap between the board and the frequency strip (Tailwind gap-3). */
export const CIPHER_STRIP_GAP = 12;

export interface CipherMetrics {
  /** Cell side in px (cells are square). */
  cell: number;
  /** Gap between letter cells inside a word. */
  cellGap: number;
  /** Gap between words on a line. */
  wordGap: number;
  /** Width reserved for a punctuation mark (not a cell). */
  punctWidth: number;
  /** Code-letter type size under each cell: 10px at the floor, 14px at the top. */
  codeFont: number;
  /** Gap between a cell and its code letter. */
  codeGap: number;
  /** Full height of one wrapped line: cell + code letter. */
  rowHeight: number;
  /** Vertical gap between wrapped lines. */
  rowGap: number;
  /** Frequency-chip type size: 11px at the floor, 14px at the top. */
  chipFont: number;
  /** Estimated rendered height of one chip (text line + padding + border). */
  chipHeight: number;
  /** Estimated rendered width of one chip at its widest ("B 3 →A"). */
  chipWidth: number;
  /** Gap between chips (Tailwind gap-1). */
  chipGap: number;
}

const lerp = (cell: number, atMin: number, atMax: number) =>
  atMin + ((cell - CIPHER_CELL_MIN) * (atMax - atMin)) / (CIPHER_CELL_MAX - CIPHER_CELL_MIN);

/** Every size on the board derived from the cell side, so they scale together. */
export function cipherMetrics(cell: number): CipherMetrics {
  const codeFont = Math.round(lerp(cell, 10, 14));
  const codeGap = 2;
  const chipFont = Math.round(lerp(cell, 11, 14));
  return {
    cell,
    cellGap: Math.max(2, Math.round(cell * 0.09)),
    wordGap: Math.round(cell * 0.45),
    punctWidth: Math.round(cell * 0.35),
    codeFont,
    codeGap,
    rowHeight: cell + codeGap + codeFont,
    rowGap: Math.round(cell * 0.25),
    chipFont,
    chipHeight: Math.round(chipFont * 1.25) + 6,
    chipWidth: Math.round(chipFont * 4.2) + 16,
    chipGap: 4,
  };
}

const isLetter = (ch: string) => ch >= 'A' && ch <= 'Z';

/** Drawn width of one word (letters as cells, anything else as punctuation). */
export function cipherWordWidth(word: string, m: CipherMetrics): number {
  let w = 0;
  const chars = [...word];
  chars.forEach((ch, i) => {
    w += isLetter(ch) ? m.cell : m.punctWidth;
    if (i < chars.length - 1) w += m.cellGap;
  });
  return w;
}

/**
 * Greedy word wrap of the cipher at `width` px with `cell`-sized cells. Words
 * never split: a word wider than the line stands alone on its own line (and the
 * fit below steps the cell down until that no longer happens).
 */
export function wrapCipherWords(cipher: string, cell: number, width: number): string[][] {
  const m = cipherMetrics(cell);
  const words = cipher.split(' ').filter((w) => w.length > 0);
  const lines: string[][] = [];
  let line: string[] = [];
  let lineWidth = 0;
  for (const word of words) {
    const w = cipherWordWidth(word, m);
    if (line.length === 0) { line = [word]; lineWidth = w; continue; }
    if (lineWidth + m.wordGap + w <= width) { line.push(word); lineWidth += m.wordGap + w; }
    else { lines.push(line); line = [word]; lineWidth = w; }
  }
  if (line.length) lines.push(line);
  return lines;
}

/** Widest single word at this cell size — must fit the band width or the cell steps down. */
export function cipherLongestWordWidth(cipher: string, cell: number): number {
  const m = cipherMetrics(cell);
  return cipher.split(' ').reduce((max, w) => Math.max(max, cipherWordWidth(w, m)), 0);
}

/** Estimated height of the frequency strip: `chipCount` chips wrapping at `width`. */
export function cipherStripHeight(chipCount: number, cell: number, width: number): number {
  if (chipCount <= 0) return 0;
  const m = cipherMetrics(cell);
  const perLine = Math.max(1, Math.floor((width + m.chipGap) / (m.chipWidth + m.chipGap)));
  const lines = Math.ceil(chipCount / perLine);
  return lines * m.chipHeight + (lines - 1) * m.chipGap;
}

/** Height of the board + strip block at this cell size, wrapped at `width`. */
export function cipherBlockHeight(cipher: string, cell: number, width: number, chipCount: number): number {
  const m = cipherMetrics(cell);
  const lines = wrapCipherWords(cipher, cell, width).length;
  const board = lines * m.rowHeight + Math.max(0, lines - 1) * m.rowGap;
  const strip = cipherStripHeight(chipCount, cell, width);
  return board + (strip > 0 ? CIPHER_STRIP_GAP + strip : 0);
}

/**
 * The cell side for a band of `width` × `height` px: start at 64 and step down
 * 4 at a time until the wrapped cipher plus the strip fits the height and the
 * longest word fits the width; floor 40.
 */
export function fitCipherCell(cipher: string, width: number, height: number, chipCount: number): number {
  for (let cell = CIPHER_CELL_MAX; cell > CIPHER_CELL_MIN; cell -= CIPHER_CELL_STEP) {
    if (cipherLongestWordWidth(cipher, cell) > width) continue;
    if (cipherBlockHeight(cipher, cell, width, chipCount) <= height) return cell;
  }
  return CIPHER_CELL_MIN;
}
