let allowedWords = new Set();
let allowedWordsArray = [];
let solutionWords = [];
// Pre-curation 5-letter answer bank. Daily seeds dated before the cutover
// resolve against THIS list so historical replays + the Past Words archive
// keep producing exactly the words that were actually played, while new
// dailies and all random/VS games use the curated `solutionWords`.
let legacySolutionWords = [];
/**
 * First daily date (YYYY-MM-DD) governed by the curated answer list. Daily
 * seeds strictly before this use the legacy list. Plain string compare —
 * YYYY-MM-DD sorts lexicographically. Set to a day after the curated list is
 * live on web/server AND the app builds carrying it have shipped.
 */
export const SOLUTIONS_CUTOVER_DATE = '2026-07-08';
// Multi-length dictionaries (for 6-letter, 7-letter, etc.)
const lengthDictionaries = new Map();
export function initDictionary(allowed, solutions, legacySolutions) {
    allowedWords = new Set(allowed.map(w => w.toUpperCase()));
    allowedWordsArray = allowed.map(w => w.toUpperCase());
    solutionWords = solutions.map(w => w.toUpperCase());
    // Defense: a 2-arg re-init (e.g. a page pre-warm) must never WIPE an
    // already-loaded legacy list — that made every pre-cutover daily throw
    // (production incident 2026-07-06). Omitted = keep whatever is loaded.
    if (legacySolutions !== undefined) {
        legacySolutionWords = legacySolutions.map(w => w.toUpperCase());
    }
}
/**
 * The 5-letter answer pool for a given daily date (or null for non-daily
 * seeds). Pre-cutover daily dates → the legacy list; everything else → the
 * curated list. Throws if a pre-cutover date is requested but no legacy list
 * was loaded — a silent fall-through to the curated list would corrupt
 * pre-cutover replays/archive invisibly, which is the worst failure mode.
 */
export function getSolutionPoolForDate(dateKey) {
    if (dateKey !== null && dateKey < SOLUTIONS_CUTOVER_DATE) {
        if (legacySolutionWords.length === 0) {
            throw new Error('Legacy solutions not initialized — pre-cutover seed cannot be resolved');
        }
        return legacySolutionWords;
    }
    return solutionWords;
}
export function initDictionaryForLength(length, allowed, solutions, legacySolutions) {
    const allowedArray = allowed.map(w => w.toUpperCase());
    lengthDictionaries.set(length, {
        allowed: new Set(allowedArray),
        allowedArray,
        solutions: solutions.map(w => w.toUpperCase()),
        legacySolutions: (legacySolutions ?? []).map(w => w.toUpperCase()),
    });
}
/**
 * Length-keyed analogue of getSolutionPoolForDate — pre-cutover daily dates
 * resolve against that length's legacy list (Six/Seven history stays pinned),
 * everything else against the curated list. Same fail-loud rule.
 */
export function getSolutionPoolForLengthAndDate(length, dateKey) {
    const dict = lengthDictionaries.get(length);
    if (!dict || dict.solutions.length === 0) {
        throw new Error(`Dictionary not initialized for ${length}-letter words`);
    }
    if (dateKey !== null && dateKey < SOLUTIONS_CUTOVER_DATE) {
        if (dict.legacySolutions.length === 0) {
            throw new Error(`Legacy ${length}-letter solutions not initialized — pre-cutover seed cannot be resolved`);
        }
        return dict.legacySolutions;
    }
    return dict.solutions;
}
export function getAllowedWords() {
    return allowedWordsArray;
}
/**
 * Full allowed list for a word length. Uses the length-keyed dictionary
 * (initDictionaryForLength — the real 6/7-letter lists) when one is loaded;
 * otherwise filters the default dictionary. The default allowed list is
 * ~9.3k FIVE-letter words plus a couple of stray 6/7-letter entries, so
 * callers needing 6/7-letter words MUST use this, not getAllowedWords().
 */
export function getAllowedWordsForLength(length) {
    const dict = lengthDictionaries.get(length);
    if (dict)
        return dict.allowedArray;
    return allowedWordsArray.filter(w => w.length === length);
}
export function isValidWord(word) {
    const upper = word.toUpperCase();
    // Check length-specific dictionary first
    const lengthDict = lengthDictionaries.get(upper.length);
    if (lengthDict) {
        return lengthDict.allowed.has(upper);
    }
    // Fall back to default (5-letter) dictionary
    return allowedWords.has(upper);
}
export function isWordValid(word) {
    return isValidWord(word);
}
export function getSolutionWord(index) {
    if (solutionWords.length === 0) {
        throw new Error('Dictionary not initialized');
    }
    return solutionWords[index % solutionWords.length];
}
export function getSolutionCount() {
    return solutionWords.length;
}
export function getSolutionWordForLength(length, index) {
    const dict = lengthDictionaries.get(length);
    if (!dict || dict.solutions.length === 0) {
        throw new Error(`Dictionary not initialized for ${length}-letter words`);
    }
    return dict.solutions[index % dict.solutions.length];
}
export function getSolutionCountForLength(length) {
    const dict = lengthDictionaries.get(length);
    return dict ? dict.solutions.length : 0;
}
