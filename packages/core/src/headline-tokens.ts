// FINISH_SPEC AR: live lettering for the rotating personalized headlines. A
// headline ("WARMING UP · 3 DOWN", "OLIVER LEADS TODAY'S RACE", "YOU'RE #3
// TODAY") is split into tokens so every platform styles the same pieces:
//   number → gold soft numbers ("3", "6,976", "#2", "3/8", "3:12", "85%", "3RD")
//   name   → the palette's accent gradient (the player's / a friend's name)
//   star   → the "·" separator, drawn as the tiny gold star sprite
//   text   → the main lettering (spaces included)
// Pure, so web, iOS and Android agree: the Swift and Kotlin ports assert
// against headline-tokens-fixtures.json (scripts/gen-parity-fixtures.ts).

export type HeadlineTokenKind = 'text' | 'number' | 'name' | 'star';

export interface HeadlineToken {
  kind: HeadlineTokenKind;
  text: string;
}

/** The separator that becomes the star sprite. */
export const HEADLINE_STAR = '\u00b7';

const NUMBER = /^#?\d+(?:[,.:/]\d+)*(?:%|ST|ND|RD|TH)?/i;

function isWordChar(ch: string | undefined): boolean {
  return !!ch && /[A-Za-z0-9_]/.test(ch);
}

/**
 * Split `text` into styled tokens. `names` are matched case-insensitively as
 * whole words (longest first); blank names are ignored. Adjacent plain text
 * merges into one token; nothing is dropped (the tokens join back to `text`).
 */
export function headlineTokens(text: string, names: readonly string[] = []): HeadlineToken[] {
  const wanted = [...new Set(names.map((n) => n.trim()).filter((n) => n.length > 0))]
    .sort((a, b) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0));
  const lower = text.toLowerCase();
  const out: HeadlineToken[] = [];
  const push = (kind: HeadlineTokenKind, piece: string) => {
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += piece;
    else out.push({ kind, text: piece });
  };
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === HEADLINE_STAR) { push('star', ch); i += 1; continue; }
    const prev = i > 0 ? text[i - 1] : undefined;
    if (!isWordChar(prev)) {
      const name = wanted.find((n) => lower.startsWith(n.toLowerCase(), i) && !isWordChar(text[i + n.length]));
      if (name) { push('name', text.slice(i, i + name.length)); i += name.length; continue; }
      const m = NUMBER.exec(text.slice(i));
      if (m && /\d/.test(m[0]) && !/[A-Za-z]/.test(text[i + m[0].length] ?? '')) {
        push('number', m[0]); i += m[0].length; continue;
      }
    }
    push('text', ch);
    i += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// FINISH_SPEC BJ6 (founder 10-03: "make sure we have a clever way to populate
// longer usernames without shrinking anything down or scrolling off screen"):
// the Home greeting's line layout, decided identically on every platform.
// Widths are in em of the brand lettering (Nunito Black, wght 900 advances),
// plus the 1% tracking per character and the outline / 3D edge (0.24 em).
//   1. the whole headline fits `maxEm` → one line;
//   2. else, a headline with the player's name stacks: the words before the
//      name on line 1 ("GOOD AFTERNOON,"), the NAME + its "!" / "?" on line 2
//      (the hero line), both at the full designed size;
//   3. a name that still doesn't fit breaks at a natural boundary (space, _ . -,
//      a letter↔digit run, camelCase), then by characters — never shrunk,
//      never truncated, never clipped.
// Headlines without the name stay one line (platforms shrink those to fit).

/** Nunito Black (wght 900) advance widths in em, for the lettering's characters. */
export const HEADLINE_ADVANCE_EM: Readonly<Record<string, number>> = {
  A: 0.763, B: 0.702, C: 0.688, D: 0.786, E: 0.614, F: 0.579, G: 0.747, H: 0.786, I: 0.312, J: 0.39, K: 0.712,
  L: 0.585, M: 0.884, N: 0.758, O: 0.807, P: 0.676, Q: 0.807, R: 0.706, S: 0.651, T: 0.644, U: 0.748, V: 0.742,
  W: 1.128, X: 0.698, Y: 0.645, Z: 0.625,
  '0': 0.6, '1': 0.6, '2': 0.6, '3': 0.6, '4': 0.6, '5': 0.6, '6': 0.6, '7': 0.6, '8': 0.6, '9': 0.6,
  ' ': 0.286, ',': 0.272, '.': 0.272, '!': 0.272, '?': 0.478, _: 0.5, '-': 0.445, "'": 0.269, '#': 0.6, ':': 0.272,
  '/': 0.349, '%': 0.964, '+': 0.6, '\u00b7': 0.272,
};
/** Unknown characters count as the widest letter (never under-measure). */
const ADVANCE_FALLBACK_EM = 1.128;
/** Tracking per character and the outline / 3D edge on both ends. */
export const HEADLINE_TRACKING_EM = 0.01;
export const HEADLINE_EDGE_EM = 0.24;
/** The largest designed lettering size (pt / dp / px). */
export const HEADLINE_MAX_SIZE = 38;
/** The longest fixed greeting line: it sets the device's full size. */
export const HEADLINE_SIZING_LINE = 'GOOD AFTERNOON,';

/** The lettering width of `text` (uppercased) in em. */
export function headlineWidthEm(text: string): number {
  const up = text.toUpperCase();
  let w = 0;
  for (const ch of up) w += (HEADLINE_ADVANCE_EM[ch] ?? ADVANCE_FALLBACK_EM) + HEADLINE_TRACKING_EM;
  return Math.round((w + HEADLINE_EDGE_EM) * 1000) / 1000;
}

/** The device's full lettering size: the longest fixed greeting line fits `availableWidth`, capped at 38. */
export function headlineFontSize(availableWidth: number, max = HEADLINE_MAX_SIZE): number {
  if (!(availableWidth > 0)) return max;
  return Math.max(12, Math.min(max, Math.floor(availableWidth / headlineWidthEm(HEADLINE_SIZING_LINE))));
}

function wrapWords(text: string, maxEm: number): string[] {
  const words = text.split(' ').filter((w) => w.length > 0);
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && headlineWidthEm(next) > maxEm) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/** The name's natural break points (indexes where a new piece starts), from its original spelling. */
function nameSegments(name: string): string[] {
  const segs: string[] = [];
  let cur = '';
  const kind = (c: string) => (/[0-9]/.test(c) ? 'd' : /[A-Za-z]/.test(c) ? 'a' : 's');
  for (let i = 0; i < name.length; i++) {
    const c = name[i];
    const prev = i > 0 ? name[i - 1] : '';
    const boundary = cur.length > 0 && (
      (kind(prev) === 's') ||
      (kind(prev) !== 's' && kind(c) !== 's' && kind(prev) !== kind(c)) ||
      (/[a-z]/.test(prev) && /[A-Z]/.test(c))
    );
    if (boundary) { segs.push(cur); cur = ''; }
    cur += c;
  }
  if (cur) segs.push(cur);
  return segs;
}

function hardSplit(piece: string, maxEm: number): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of piece) {
    if (cur && headlineWidthEm(cur + ch) > maxEm) { out.push(cur); cur = ch; } else cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

/** The name (+ trailing punctuation) as full-size lines no wider than `maxEm`. */
function nameLines(name: string, suffix: string, maxEm: number): string[] {
  const whole = name.toUpperCase() + suffix;
  if (headlineWidthEm(whole) <= maxEm) return [whole];
  // The punctuation rides with the last piece, so it never lands on a line of its own.
  const pieces = nameSegments(name).map((p) => p.toUpperCase());
  pieces[pieces.length - 1] += suffix;
  const out: string[] = [];
  let cur = '';
  for (const p of pieces) {
    const next = cur + p;
    if (headlineWidthEm(next.trim()) <= maxEm) { cur = next; continue; }
    if (cur.trim()) out.push(cur.trim());
    if (headlineWidthEm(p.trim()) <= maxEm) cur = p;
    else { const parts = hardSplit(p.trim(), maxEm); out.push(...parts.slice(0, -1)); cur = parts[parts.length - 1]; }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export interface HeadlineLayout {
  /** The lines, top to bottom (one line when it fits). */
  lines: string[];
  /** The lines that carry the player's name when stacked (the gold hero lines); empty on one line. */
  nameLines: number[];
}

/**
 * BJ6: lay out a Home headline for `maxEm` (the available width ÷ the font size).
 * `name` is the player's username as stored (its spelling decides camelCase breaks).
 */
export function headlineLayout(text: string, name: string, maxEm: number): HeadlineLayout {
  if (headlineWidthEm(text) <= maxEm) return { lines: [text], nameLines: [] };
  const n = name.trim();
  if (!n) return { lines: [text], nameLines: [] };
  const up = text.toUpperCase();
  const nUp = n.toUpperCase();
  let idx = -1;
  for (let i = up.indexOf(nUp); i >= 0; i = up.indexOf(nUp, i + 1)) {
    const before = up[i - 1];
    const after = up[i + nUp.length];
    if ((!before || !/[A-Z0-9_]/.test(before)) && (!after || !/[A-Z0-9_]/.test(after))) { idx = i; break; }
  }
  if (idx < 0) return { lines: [text], nameLines: [] };
  const before = text.slice(0, idx).trim();
  const after = text.slice(idx + n.length);
  const punct = /^[!?.,]*$/.test(after) ? after : '';
  const lines: string[] = before ? wrapWords(before, maxEm) : [];
  const first = lines.length;
  lines.push(...nameLines(n, punct, maxEm));
  const named = Array.from({ length: lines.length - first }, (_, k) => first + k);
  if (!punct && after.trim()) lines.push(...wrapWords(after.trim(), maxEm));
  return { lines, nameLines: named };
}
