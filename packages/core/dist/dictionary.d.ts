/**
 * First daily date (YYYY-MM-DD) governed by the curated answer list. Daily
 * seeds strictly before this use the legacy list. Plain string compare —
 * YYYY-MM-DD sorts lexicographically. Set to a day after the curated list is
 * live on web/server AND the app builds carrying it have shipped.
 */
export declare const SOLUTIONS_CUTOVER_DATE = "2026-07-08";
export declare function initDictionary(allowed: string[], solutions: string[], legacySolutions?: string[]): void;
/**
 * The 5-letter answer pool for a given daily date (or null for non-daily
 * seeds). Pre-cutover daily dates → the legacy list; everything else → the
 * curated list. Throws if a pre-cutover date is requested but no legacy list
 * was loaded — a silent fall-through to the curated list would corrupt
 * pre-cutover replays/archive invisibly, which is the worst failure mode.
 */
export declare function getSolutionPoolForDate(dateKey: string | null): string[];
export declare function initDictionaryForLength(length: number, allowed: string[], solutions: string[], legacySolutions?: string[]): void;
/**
 * Length-keyed analogue of getSolutionPoolForDate — pre-cutover daily dates
 * resolve against that length's legacy list (Six/Seven history stays pinned),
 * everything else against the curated list. Same fail-loud rule.
 */
export declare function getSolutionPoolForLengthAndDate(length: number, dateKey: string | null): string[];
export declare function getAllowedWords(): string[];
/**
 * Full allowed list for a word length. Uses the length-keyed dictionary
 * (initDictionaryForLength — the real 6/7-letter lists) when one is loaded;
 * otherwise filters the default dictionary. The default allowed list is
 * ~9.3k FIVE-letter words plus a couple of stray 6/7-letter entries, so
 * callers needing 6/7-letter words MUST use this, not getAllowedWords().
 */
export declare function getAllowedWordsForLength(length: number): string[];
export declare function isValidWord(word: string): boolean;
export declare function isWordValid(word: string): boolean;
export declare function getSolutionWord(index: number): string;
export declare function getSolutionCount(): number;
export declare function getSolutionWordForLength(length: number, index: number): string;
export declare function getSolutionCountForLength(length: number): number;
//# sourceMappingURL=dictionary.d.ts.map