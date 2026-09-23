import { bankIndexForDay, bankIndexForSeed, bankDayIndex, bankHolidayPick, type HolidayTable } from '../bank';

/**
 * Codebreaker — cryptogram (More Games §16). A well-known saying is written in
 * a substitution cipher (a stored 26-letter derangement per puzzle, so parity
 * is "read a string"); the three most frequent letters are GIVEN and locked.
 * The player taps a code letter and types the plain letter they think it
 * stands for; every occurrence fills at once. Letters are PENCIL, always:
 * setting, changing and clearing are free and unlimited — trial and error IS
 * the game. Two code letters mapped to the same plain letter show red (a
 * conflict) and block completion. The puzzle completes itself the moment every
 * letter is right.
 *
 * Costs: CHECK marks wrong letters (clears them) and locks right ones, and
 * counts: guess_count = min(checks, 3) + 1, so a solve with no Check is
 * perfect and the board otherwise ranks by time. HINT reveals one mapping
 * (the most frequent unresolved code letter; 100 points). REVEAL (offered
 * after five minutes) fills the answer and records a loss. Event sigils (§11):
 * "=C:P" set, "-C" cleared, "#n" check with n wrong, "?C" hint, "!" reveal.
 *
 * Banks (apps/web/data/cryptogram-puzzles.json, bundled everywhere and
 * sha-guarded) carry { daily, extra, holiday: { key: [...] } }; on a holiday
 * (§20, holiday-days.json) the daily comes from that holiday's own list.
 *
 * Parity-critical: Cryptogram.swift / Cryptogram.kt reproduce this exactly;
 * cryptogram-fixtures.json pins all three.
 */

export const CRYPTOGRAM_DAILY_EPOCH = '2026-09-23';
export const CRYPTOGRAM_MAX_CHECKS = 3;
export const CRYPTOGRAM_REVEAL_AFTER_SECONDS = 300;
export const CRYPTOGRAM_TOTAL_BOARDS = 1;
export const CRYPTOGRAM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export interface CryptogramPuzzle {
  id: string;
  /** The saying, as displayed (mixed case, punctuation). */
  text: string;
  /** 26 uppercase letters: key[i] is the CODE letter for plain letter ALPHABET[i]. A derangement. */
  key: string;
  /** Plain letters given (locked) from the start — the three most frequent. */
  given: string[];
  holiday?: string;
}

export interface CryptogramBank {
  version: number;
  epoch: string;
  daily: CryptogramPuzzle[];
  extra: CryptogramPuzzle[];
  holiday?: Record<string, CryptogramPuzzle[]>;
}

/** The saying enciphered: letters mapped through the key, everything else kept. */
export function cryptogramEncipher(text: string, key: string): string {
  let out = '';
  for (const ch of text.toUpperCase()) {
    const i = CRYPTOGRAM_ALPHABET.indexOf(ch);
    out += i >= 0 ? key[i] : ch;
  }
  return out;
}
/** The plain letter a CODE letter stands for. */
export function cryptogramPlainFor(code: string, key: string): string {
  const i = key.indexOf(code);
  return i >= 0 ? CRYPTOGRAM_ALPHABET[i] : '';
}
/** The CODE letter for a plain letter. */
export function cryptogramCodeFor(plain: string, key: string): string {
  const i = CRYPTOGRAM_ALPHABET.indexOf(plain);
  return i >= 0 ? key[i] : '';
}
/** Distinct code letters that occur in the cipher text, alphabetical. */
export function cryptogramCodeLetters(cipher: string): string[] {
  const set = new Set<string>();
  for (const ch of cipher) if (CRYPTOGRAM_ALPHABET.includes(ch)) set.add(ch);
  return [...set].sort();
}
/** Occurrences of each code letter in the cipher text (the frequency strip). */
export function cryptogramFrequencies(cipher: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ch of cipher) if (CRYPTOGRAM_ALPHABET.includes(ch)) out[ch] = (out[ch] ?? 0) + 1;
  return out;
}

/** The daily puzzle for `day`: the holiday's own entry when the calendar names one, else epoch-indexed. */
export function cryptogramPuzzleForDay(bank: CryptogramBank, day: string, holidays?: HolidayTable | null): CryptogramPuzzle | null {
  const pick = bankHolidayPick(day, holidays, bank.holiday);
  if (pick) return pick.entry;
  if (!bank.daily.length) return null;
  return bank.daily[bankIndexForDay(day, bank.daily.length, bank.epoch)] ?? null;
}
export function cryptogramPuzzleForSeed(bank: CryptogramBank, seed: string): CryptogramPuzzle | null {
  const pool = bank.extra.length ? bank.extra : bank.daily;
  if (!pool.length) return null;
  return pool[bankIndexForSeed(seed, pool.length)] ?? null;
}
export function cryptogramDailyNumber(day: string): number {
  const idx = bankDayIndex(day, CRYPTOGRAM_DAILY_EPOCH);
  return idx === null ? 1 : Math.max(1, idx + 1);
}

// ── Reducer ────────────────────────────────────────────────────────────────

export type CryptogramStatus = 'playing' | 'won' | 'lost';

export interface CryptogramState {
  seed: string;
  id: string;
  text: string;
  key: string;
  cipher: string;
  given: string[];
  /** code letter → the plain letter the player has pencilled in. */
  mapping: Record<string, string>;
  /** Code letters that can no longer change: given, checked-correct, hinted, revealed. Alphabetical. */
  locked: string[];
  /** Code letters filled by Hint. */
  hinted: string[];
  hintsUsed: number;
  checks: number;
  /** Code letters the last Check cleared (for the red flash); empty otherwise. */
  lastWrong: string[];
  events: string[];
  status: CryptogramStatus;
  ended: boolean;
  startTime: number;
  endTime: number | null;
}

export type CryptogramAction =
  | { type: 'SET'; code: string; plain: string | null }
  | { type: 'CHECK' }
  | { type: 'HINT' }
  | { type: 'REVEAL' }
  | { type: 'FINISH' };

export function createCryptogramState(p: CryptogramPuzzle, seed: string, startTime: number): CryptogramState {
  const cipher = cryptogramEncipher(p.text, p.key);
  const mapping: Record<string, string> = {};
  const locked: string[] = [];
  for (const plain of p.given) {
    const code = cryptogramCodeFor(plain, p.key);
    if (code && cipher.includes(code)) { mapping[code] = plain; locked.push(code); }
  }
  locked.sort();
  return {
    seed, id: p.id, text: p.text, key: p.key, cipher, given: [...p.given], mapping, locked, hinted: [],
    hintsUsed: 0, checks: 0, lastWrong: [], events: [], status: 'playing', ended: false, startTime, endTime: null,
  };
}

/** True when every code letter in the text is mapped to its true plain letter. */
export function cryptogramIsSolved(s: { cipher: string; key: string; mapping: Record<string, string> }): boolean {
  for (const code of cryptogramCodeLetters(s.cipher)) if (s.mapping[code] !== cryptogramPlainFor(code, s.key)) return false;
  return true;
}
/** Plain letters used for more than one code letter (shown red; block completion by definition). */
export function cryptogramConflicts(mapping: Record<string, string>): string[] {
  const seen: Record<string, number> = {};
  for (const p of Object.values(mapping)) seen[p] = (seen[p] ?? 0) + 1;
  return Object.keys(seen).filter((p) => seen[p] > 1).sort();
}
/** Code letters in the text right now correct (mapped to the truth). */
export function cryptogramCorrectCount(s: { cipher: string; key: string; mapping: Record<string, string> }): number {
  let n = 0;
  for (const code of cryptogramCodeLetters(s.cipher)) if (s.mapping[code] === cryptogramPlainFor(code, s.key)) n++;
  return n;
}
/** guess_count for the result row: no Check = 1, capped at MAX_CHECKS + 1. */
export function cryptogramGuessCount(checks: number): number { return Math.min(checks, CRYPTOGRAM_MAX_CHECKS) + 1; }

/** The Hint target: the most frequent code letter not yet correct-and-locked; ties alphabetical. */
export function cryptogramHintTarget(s: CryptogramState): string | null {
  const freq = cryptogramFrequencies(s.cipher);
  let best: string | null = null;
  for (const code of cryptogramCodeLetters(s.cipher)) {
    if (s.locked.includes(code) && s.mapping[code] === cryptogramPlainFor(code, s.key)) continue;
    if (best === null || freq[code] > freq[best] || (freq[code] === freq[best] && code < best)) best = code;
  }
  return best;
}

function settle(s: CryptogramState, now: number): CryptogramState {
  if (s.status === 'playing' && cryptogramIsSolved(s)) return { ...s, status: 'won', ended: true, endTime: now };
  return s;
}
const addLocked = (locked: string[], code: string) => (locked.includes(code) ? locked : [...locked, code].sort());

export function cryptogramReduce(s: CryptogramState, a: CryptogramAction, now = 0): CryptogramState {
  if (a.type === 'FINISH') return s.status === 'playing' ? s : { ...s, endTime: s.endTime ?? now };
  if (s.ended) return s;

  switch (a.type) {
    case 'SET': {
      const code = a.code.toUpperCase();
      if (!CRYPTOGRAM_ALPHABET.includes(code) || !s.cipher.includes(code) || s.locked.includes(code)) return s;
      const mapping = { ...s.mapping };
      if (a.plain === null || a.plain === '') {
        if (!(code in mapping)) return s;
        delete mapping[code];
        return { ...s, mapping, lastWrong: [], events: [...s.events, `-${code}`] };
      }
      const plain = a.plain.toUpperCase();
      if (!CRYPTOGRAM_ALPHABET.includes(plain) || plain.length !== 1) return s;
      if (mapping[code] === plain) return s;
      mapping[code] = plain;
      return settle({ ...s, mapping, lastWrong: [], events: [...s.events, `=${code}:${plain}`] }, now);
    }
    case 'CHECK': {
      const mapping = { ...s.mapping };
      let locked = s.locked;
      const wrong: string[] = [];
      for (const code of Object.keys(mapping).sort()) {
        if (mapping[code] === cryptogramPlainFor(code, s.key)) locked = addLocked(locked, code);
        else { delete mapping[code]; wrong.push(code); }
      }
      return { ...s, mapping, locked, checks: s.checks + 1, lastWrong: wrong, events: [...s.events, `#${wrong.length}`] };
    }
    case 'HINT': {
      const code = cryptogramHintTarget(s);
      if (!code) return s;
      const mapping = { ...s.mapping, [code]: cryptogramPlainFor(code, s.key) };
      return settle({
        ...s, mapping, locked: addLocked(s.locked, code), hinted: [...s.hinted, code], hintsUsed: s.hintsUsed + 1,
        lastWrong: [], events: [...s.events, `?${code}`],
      }, now);
    }
    case 'REVEAL': {
      const mapping: Record<string, string> = {};
      const codes = cryptogramCodeLetters(s.cipher);
      for (const code of codes) mapping[code] = cryptogramPlainFor(code, s.key);
      return { ...s, mapping, locked: codes, lastWrong: [], events: [...s.events, '!'], status: 'lost', ended: true, endTime: now };
    }
    default:
      return s;
  }
}

// ── Matches row ↔ state ────────────────────────────────────────────────────

/**
 * solutions = [text, key26, id]; guesses = ["=" + mapping26, "h" + mask26, "c" + checks]
 * where position i of each 26-string is CODE letter ALPHABET[i]: mapping26 holds
 * the pencilled plain letter or "."; mask26 holds "g" given, "h" hinted, "r"
 * revealed, "l" locked by a Check, "." otherwise.
 */
export function cryptogramMatchRow(s: CryptogramState): { solutions: string[]; guesses: string[] } {
  let mapping26 = '', mask26 = '';
  const givenCodes = s.given.map((p) => cryptogramCodeFor(p, s.key));
  const revealed = s.status === 'lost' && s.events.includes('!');
  for (const code of CRYPTOGRAM_ALPHABET) {
    mapping26 += s.mapping[code] ?? '.';
    if (!s.cipher.includes(code)) mask26 += '.';
    else if (givenCodes.includes(code)) mask26 += 'g';
    else if (s.hinted.includes(code)) mask26 += 'h';
    else if (revealed) mask26 += 'r';
    else if (s.locked.includes(code)) mask26 += 'l';
    else mask26 += '.';
  }
  return { solutions: [s.text, s.key, s.id], guesses: [`=${mapping26}`, `h${mask26}`, `c${s.checks}`] };
}

export interface CryptogramReconstruction {
  id: string; text: string; key: string; cipher: string;
  mapping: Record<string, string>; given: string[]; hinted: string[]; revealed: boolean; checks: number;
  correct: number; total: number; solved: boolean;
}

export function reconstructCryptogram(solutions: string[] | null | undefined, guesses: string[] | null | undefined): CryptogramReconstruction | null {
  if (!solutions || solutions.length < 2) return null;
  const [text, key, id] = solutions;
  if (!text || !/^[A-Z]{26}$/.test(key ?? '') || new Set(key).size !== 26) return null;
  const cipher = cryptogramEncipher(text, key);
  const mapping: Record<string, string> = {}, given: string[] = [], hinted: string[] = [];
  let revealed = false, checks = 0;
  for (const g of guesses ?? []) {
    if (g[0] === '=' && g.length === 27) { for (let i = 0; i < 26; i++) if (g[i + 1] !== '.') mapping[CRYPTOGRAM_ALPHABET[i]] = g[i + 1]; }
    else if (g[0] === 'h' && g.length === 27) { for (let i = 0; i < 26; i++) { const c = g[i + 1], code = CRYPTOGRAM_ALPHABET[i]; if (c === 'g') given.push(cryptogramPlainFor(code, key)); else if (c === 'h') hinted.push(code); else if (c === 'r') revealed = true; } }
    else if (g[0] === 'c') checks = Math.max(0, Number(g.slice(1)) || 0);
  }
  const total = cryptogramCodeLetters(cipher).length;
  const correct = cryptogramCorrectCount({ cipher, key, mapping });
  return { id: id ?? '', text, key, cipher, mapping, given, hinted, revealed, checks, correct, total, solved: !revealed && correct === total };
}
