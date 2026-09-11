// §259: which sense a word LEADS with. Wiktionary orders parts of speech
// historically, not by how people use the word, and our generator kept one
// definition per part of speech in that order — so NASTY led with its rare
// noun sense ("Something nasty.") and CLIMB with "An act of climbing." A
// definition that needs the word it defines is no definition.
//
// Rank: circular (3) > cross-reference stub (2) > defined through the word (1)
// > clean (0); ties keep source order. The web lib, iOS and Android apply the
// SAME rule at read time (pickPrimarySense) so a future dataset with a bad
// first sense still displays well. Keep the three ports in lock-step.

/** The headword or an inflection of it, in LOWERCASE (a capitalised mention —
 *  "the Bible", "the Blitz" — is a name, not circularity). */
export function mentions(word, def) {
  const w = word.toLowerCase();
  if (w.length < 3) return false;
  const stem = /[ey]$/.test(w) ? w.slice(0, -1) : w;
  const re = new RegExp(`(^|[^A-Za-z])(${w}|${stem}(s|es|ed|ing|ies|ied|er|ers|ly|ness|iness))(?![A-Za-z])`);
  return re.test(def || '');
}

/** The definition with its labels stripped: "(obsolete)", "(usually plural)",
 *  and a leading usage note such as "Preceded by the:" or "Often followed by up:". */
export function core(def) {
  return (def || '').replace(/\([^)]*\)/g, '').replace(/^[^:.;]{0,40}:\s*/, '').trim();
}

/** Placeholder frames wrapped around the headword: "Something nasty.",
 *  "An act of climbing.", "One who is left-handed." Real definitions that
 *  merely use the word ("The sharp cutting edge of a knife … a sword blade")
 *  are NOT circular. */
const FRAMES = /^(something|someone|somebody|anything|one who|one that|those who|that which|the (act|action|state|quality|condition|result|process|sound|instance|manner|fact|practice) of|an? (\w+ )?(act|action|instance|state|quality|result|sound|process|bout|fit) of|a person who|a thing that|an? \w+ (thing|things|person|people|event|one|ones)\b|in an? \w+ (manner|way)\b|to (make|become|be|render) \w+ )/i;

export function isCircular(word, def) {
  const c = core(def);
  return !!c && mentions(word, c) && FRAMES.test(c);
}

/** Defined THROUGH the headword rather than around it: the word used
 *  attributively right after the article ("A dusky shark", "A lucid dream",
 *  "The legal department", "A silly person"), as the object of a defining
 *  verb ("To make dizzy", "To grow plump", "To give an acute sound to"), or
 *  as the definition's final word ("… to cause to behave as … human").
 *  A later mention ("a boxing match", "ice skating", "a sword blade") is a
 *  real definition and is left alone. */
export function isDerived(word, def) {
  const c = core(def);
  if (!c || !mentions(word, c)) return false;
  const words = c.split(/\s+/);
  const head = words.slice(0, 4).join(' ');
  const tail = words.slice(-2).join(' ');
  if (mentions(word, words[0])) return true;              // "happy people as a group"
  // A short gloss that lands on the headword: "The absence of sound; quietness."
  if (words.length <= 6 && mentions(word, tail)) return true;
  if (/^(an?|the|any|one|its)\b/i.test(c)) return mentions(word, head);
  // Verbs only for the tail: "To make dizzy", "… or become, human". Nouns end
  // in compounds all the time ("a sword blade", "an orange tree") and stay.
  if (/^to\b/i.test(c)) return mentions(word, head) || mentions(word, tail);
  return false;
}

/** Cross-references that define nothing on their own. Inflection notes
 *  ("plural of calf", "past participle of break") are accurate and stay. */
export function isStub(def) {
  const d = (def || '').trim();
  if (d.length < 4) return true;
  return /^(see\b|alternative (form|spelling|letter-case form|case form) of|misspelling of|obsolete (form|spelling) of|archaic (form|spelling) of|dated (form|spelling) of|initialism of|abbreviation of|acronym of|synonym of|eye dialect (spelling )?of|clipping of|short for\b)/i.test(d);
}

export function senseScore(word, sense) {
  const def = sense?.def || '';
  if (isCircular(word, def)) return 3;
  if (isStub(def)) return 2;
  return isDerived(word, def) ? 1 : 0;
}

/** Stable: best score first, source order within a score. (A part-of-speech
 *  tiebreak was tried and rejected: it touched 1,500 entries and demoted good
 *  verb senses — Wiktionary's own order is the better signal among equals.) */
export function rankSenses(word, senses) {
  return senses
    .map((s, i) => ({ s, i, score: senseScore(word, s) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((x) => x.s);
}
