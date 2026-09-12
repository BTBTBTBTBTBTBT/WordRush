const WIKI_API = 'https://en.wikipedia.org/api/rest_v1/page/summary';

interface WikiSummary {
  extract: string;
  title: string;
  /** "standard" | "disambiguation" | "no-extract" — see the §253 guard below. */
  type?: string;
  description?: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
}

export async function fetchWikipediaHint(
  displayName: string,
  wikiTitle?: string,
  redact = true
): Promise<string> {
  const title = encodeURIComponent(
    (wikiTitle || displayName).replace(/\s+/g, '_')
  );

  const response = await fetch(`${WIKI_API}/${title}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}`);
  }

  const data: WikiSummary = await response.json();

  if (!data.extract) {
    throw new Error('No summary available');
  }

  // §253: a DISAMBIGUATION page's extract is literally "X may refer to:", which
  // redacts to "______ may refer to:" — a clue with zero information (reported
  // live on #980/Stellaris). Treat it as no clue at all; the per-puzzle
  // wikiTitle override is the real fix.
  if (data.type === 'disambiguation' || /may (also )?refer to:?\s*$/i.test(data.extract)) {
    throw new Error('Disambiguation page — no usable clue');
  }

  // redact=false keeps the answer name in the text — used on the post-game
  // result screen, where the full clue doubles as the "definition".
  return sanitizeHint(data.extract, displayName, redact);
}

export async function fetchWikipediaImage(
  displayName: string,
  wikiTitle?: string
): Promise<string | null> {
  const title = encodeURIComponent(
    (wikiTitle || displayName).replace(/\s+/g, '_')
  );

  try {
    const response = await fetch(`${WIKI_API}/${title}`, {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) return null;

    const data: WikiSummary = await response.json();
    return data.thumbnail?.source || data.originalimage?.source || null;
  } catch {
    return null;
  }
}

// Common single-word abbreviations whose internal period must NOT trigger
// a sentence-split. Wikipedia summaries are full of "No. 1", "Dr. X",
// "Inc.", etc. — without protecting them the hint truncates mid-thought
// (reported: "ranked as the world No." cutting off before the rank).
const SINGLE_WORD_ABBREVIATIONS = [
  'No', 'Nos',
  'Mr', 'Mrs', 'Ms', 'Dr', 'Prof',
  'Sr', 'Jr',
  'St', 'Mt', 'Ft',
  'Inc', 'Ltd', 'Co', 'Corp', 'Bros',
  'etc', 'vs', 'cf', 'al',
  'e.g', 'i.e',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
  'Mon', 'Tue', 'Tues', 'Wed', 'Thu', 'Thur', 'Thurs', 'Fri', 'Sat', 'Sun',
];

function sanitizeHint(extract: string, displayName: string, redact = true): string {
  // Protect multi-letter capitalized abbreviations like "U.S.", "U.K.", "D.C."
  let protected_ = extract.replace(/\b([A-Z])\.\s?([A-Z])\.(\s?[A-Z]\.)?/g, (m) => m.replace(/\./g, '###'));

  // Protect common single-word abbreviations (case-insensitive). Must
  // run before sentence segmentation so the period stays welded to the
  // preceding token rather than being treated as a sentence terminator.
  for (const abbr of SINGLE_WORD_ABBREVIATIONS) {
    const escaped = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\.`, 'gi');
    protected_ = protected_.replace(re, (m) => m.replace(/\./g, '###'));
  }

  const sentences = protected_.match(/[^.!?]+[.!?]+/g) || [protected_];
  const build = (n: number) => sentences.slice(0, n).join(' ').trim().replace(/###/g, '.');

  // Two sentences is the house length. But some articles open with fragments
  // that survive segmentation and carry nothing — Rafael Nadal's begins with
  // the honorific "Excmo. Sr. D.", Confucius's with "(c. 551 - c. 479 BCE)" —
  // and after redaction the player is left with a clue like "______(c.  551 -
  // c." (§253). So keep absorbing sentences until what actually reaches the
  // screen is substantive, instead of chasing each new abbreviation.
  let take = Math.min(2, sentences.length);
  if (redact) {
    while (take < sentences.length && informativeLength(redactAnswer(build(take), displayName)) < 60) take++;
  }
  let hint = build(take);

  // Post-game (redact=false) keeps the answer in the text — the full clue is
  // shown as the "definition" once the puzzle is over.
  if (!redact) return hint;

  return redactAnswer(hint, displayName);
}

/** Characters a player can actually read, once the blanks are taken out. */
function informativeLength(clue: string): number {
  return clue.replace(/______/g, ' ').replace(/\s+/g, ' ').trim().length;
}

/** Replaces the answer (and each of its words) with blanks. */
export function redactAnswer(hint: string, displayName: string): string {
  // Build patterns to redact: full name first, then each individual word (>2 chars)
  const nameParts = displayName.split(/\s+/).filter(p => p.length > 2);
  const patterns = [displayName, ...nameParts];

  // Match diacritic-insensitively: the answer/display name is plain ASCII
  // ("Shogun") but the Wikipedia extract often carries the accented spelling
  // ("Shōgun") — a literal match misses it and the clue leaks the answer.
  // Decompose the hint to NFD (accents → base char + combining mark) and build
  // each pattern to tolerate combining marks between letters, so "Shogun"
  // matches "Sho\u0304gun".
  const COMBINING = '[\u0300-\u036f]*';
  hint = hint.normalize('NFD');
  const build = (pattern: string) => pattern
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')       // strip any accents from the pattern itself
    .split('')
    .map(ch => (/\s/.test(ch) ? '\\s+' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + COMBINING))
    .join('');
  for (const pattern of patterns) {
    hint = hint.replace(new RegExp(build(pattern), 'gi'), '______');
  }
  // §262 (founder: OLYMPICS' clue read "The modern Olympic Games…"): an exact
  // match misses the answer's own inflections. For every word of five letters
  // or more, also redact its stem plus up to three trailing letters — Olympic,
  // Olympics, Olympian, Olympiad all go (long stems lose one more letter so the
  // -ian/-iad forms are caught). iOS/Android mirror.
  for (const part of nameParts) {
    if (part.length < 5) continue;
    let stem = /s$/i.test(part) && part.length > 4 ? part.slice(0, -1) : part;
    let tail = '[a-z]{0,3}';
    if (stem.length >= 6) { stem = stem.slice(0, -1); tail = '[a-z]{0,4}'; } // Olympi- → Olympian, Olympiad
    hint = hint.replace(new RegExp(build(stem) + tail, 'gi'), '______');
  }
  hint = hint.normalize('NFC');

  // Collapse consecutive redactions
  hint = hint.replace(/(______\s*)+/g, '______');
  hint = hint.replace(/______(\w)/g, '______ $1');

  return hint;
}
