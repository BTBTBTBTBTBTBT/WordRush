/**
 * §259: which sense a word LEADS with. Mirror of scripts/rank-senses.mjs (the
 * dataset is re-ranked with the same rule at build time; this is the read-time
 * belt-and-braces so a future dataset with a bad first sense still displays
 * well). iOS SenseRank.swift and Android SenseRank.kt are line-for-line ports —
 * change all four together.
 *
 * Rank: circular (3) > cross-reference stub (2) > defined through the word (1)
 * > clean (0); ties keep source order.
 */
export interface RankableSense { pos?: string; def?: string }

/** The headword or an inflection of it, in LOWERCASE (a capitalised mention —
 *  "the Bible", "the Blitz" — is a name, not circularity). */
export function mentions(word: string, def: string): boolean {
  const w = word.toLowerCase();
  if (w.length < 3) return false;
  const stem = /[ey]$/.test(w) ? w.slice(0, -1) : w;
  return new RegExp(`(^|[^A-Za-z])(${w}|${stem}(s|es|ed|ing|ies|ied|er|ers|ly|ness|iness))(?![A-Za-z])`).test(def || '');
}

/** Labels stripped: "(obsolete)", and a leading usage note "Preceded by the:". */
export function core(def: string): string {
  return (def || '').replace(/\([^)]*\)/g, '').replace(/^[^:.;]{0,40}:\s*/, '').trim();
}

const FRAMES = /^(something|someone|somebody|anything|one who|one that|those who|that which|the (act|action|state|quality|condition|result|process|sound|instance|manner|fact|practice) of|an? (\w+ )?(act|action|instance|state|quality|result|sound|process|bout|fit) of|a person who|a thing that|an? \w+ (thing|things|person|people|event|one|ones)\b|in an? \w+ (manner|way)\b|to (make|become|be|render) \w+ )/i;

export function isCircular(word: string, def: string): boolean {
  const c = core(def);
  return !!c && mentions(word, c) && FRAMES.test(c);
}

export function isStub(def: string): boolean {
  const d = (def || '').trim();
  if (d.length < 4) return true;
  return /^(see\b|alternative (form|spelling|letter-case form|case form) of|misspelling of|obsolete (form|spelling) of|archaic (form|spelling) of|dated (form|spelling) of|initialism of|abbreviation of|acronym of|synonym of|eye dialect (spelling )?of|clipping of|short for\b)/i.test(d);
}

export function isDerived(word: string, def: string): boolean {
  const c = core(def);
  if (!c || !mentions(word, c)) return false;
  const words = c.split(/\s+/);
  const head = words.slice(0, 4).join(' ');
  const tail = words.slice(-2).join(' ');
  if (mentions(word, words[0])) return true;
  // A short gloss that lands on the headword: "The absence of sound; quietness."
  if (words.length <= 6 && mentions(word, tail)) return true;
  if (/^(an?|the|any|one|its)\b/i.test(c)) return mentions(word, head);
  if (/^to\b/i.test(c)) return mentions(word, head) || mentions(word, tail);
  return false;
}

export function senseScore(word: string, sense: RankableSense): number {
  const def = sense?.def || '';
  if (isCircular(word, def)) return 3;
  if (isStub(def)) return 2;
  return isDerived(word, def) ? 1 : 0;
}

export function rankSenses<T extends RankableSense>(word: string, senses: T[]): T[] {
  return senses
    .map((s, i) => ({ s, i, score: senseScore(word, s) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((x) => x.s);
}

/** The sense to display first. */
export function pickPrimarySense<T extends RankableSense>(word: string, senses: T[]): T | undefined {
  return rankSenses(word, senses)[0];
}
