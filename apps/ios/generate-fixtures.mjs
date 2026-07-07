/**
 * Generate JSON test fixtures from the TypeScript game engine.
 *
 * Run from repo root:
 *   node apps/ios/generate-fixtures.mjs
 *
 * Outputs: apps/ios/Tests/Fixtures/*.json
 *
 * These fixtures are the parity contract: the Swift engine must produce
 * identical outputs for the same inputs. Any divergence is a bug in the
 * Swift port.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const coreDir = join(__dirname, '..', '..', 'packages', 'core', 'src');
const dataDir = join(__dirname, '..', 'web', 'data');
const outDir = join(__dirname, 'Tests', 'Fixtures');

mkdirSync(outDir, { recursive: true });

// --- Inline the core modules (ESM, no build step needed) ---
// We re-implement the loading here to avoid needing a full TS build.
// The logic must match packages/core/src exactly.

// === dictionary.ts ===
// Keep in lockstep with packages/core dictionary.ts SOLUTIONS_CUTOVER_DATE.
const SOLUTIONS_CUTOVER_DATE = '2026-07-08';

let allowedWords = new Set();
let allowedWordsArray = [];
let solutionWords = [];
let legacySolutionWords = [];
const lengthDictionaries = new Map();

function initDictionary(allowed, solutions, legacySolutions = []) {
  allowedWords = new Set(allowed.map(w => w.toUpperCase()));
  allowedWordsArray = allowed.map(w => w.toUpperCase());
  solutionWords = solutions.map(w => w.toUpperCase());
  legacySolutionWords = legacySolutions.map(w => w.toUpperCase());
}

function solutionPoolForDate(dateKey) {
  if (dateKey !== null && dateKey < SOLUTIONS_CUTOVER_DATE) {
    if (legacySolutionWords.length === 0) throw new Error('Legacy solutions not initialized');
    return legacySolutionWords;
  }
  return solutionWords;
}

function initDictionaryForLength(length, allowed, solutions, legacySolutions = []) {
  lengthDictionaries.set(length, {
    allowed: new Set(allowed.map(w => w.toUpperCase())),
    solutions: solutions.map(w => w.toUpperCase()),
    legacySolutions: legacySolutions.map(w => w.toUpperCase()),
  });
}

function solutionPoolForLengthAndDate(length, dateKey) {
  const dict = lengthDictionaries.get(length);
  if (dateKey !== null && dateKey < SOLUTIONS_CUTOVER_DATE) {
    if (!dict.legacySolutions.length) throw new Error(`Legacy ${length}-letter solutions not initialized`);
    return dict.legacySolutions;
  }
  return dict.solutions;
}

function isValidWord(word) {
  const upper = word.toUpperCase();
  const lengthDict = lengthDictionaries.get(upper.length);
  if (lengthDict) return lengthDict.allowed.has(upper);
  return allowedWords.has(upper);
}

function getSolutionWord(index) { return solutionWords[index]; }
function getSolutionCount() { return solutionWords.length; }
function getSolutionWordForLength(length, index) {
  const dict = lengthDictionaries.get(length);
  return dict.solutions[index];
}
function getSolutionCountForLength(length) {
  const dict = lengthDictionaries.get(length);
  return dict.solutions.length;
}
function getAllowedWords() { return allowedWordsArray; }

// === evaluator.ts ===
const TileState = { CORRECT: 'CORRECT', PRESENT: 'PRESENT', ABSENT: 'ABSENT', EMPTY: 'EMPTY', HINT_USED: 'HINT_USED' };
const GameStatus = { PLAYING: 'PLAYING', WON: 'WON', LOST: 'LOST', ABANDONED: 'ABANDONED' };
const GameMode = {
  DUEL: 'DUEL', MULTI_DUEL: 'MULTI_DUEL', GAUNTLET: 'GAUNTLET',
  QUORDLE: 'QUORDLE', OCTORDLE: 'OCTORDLE', SEQUENCE: 'SEQUENCE',
  RESCUE: 'RESCUE', TOURNAMENT: 'TOURNAMENT', PROPERNOUNDLE: 'PROPERNOUNDLE',
  DUEL_6: 'DUEL_6', DUEL_7: 'DUEL_7',
};

function evaluateGuess(solution, guess) {
  const solutionUpper = solution.toUpperCase();
  const guessUpper = guess.toUpperCase();
  if (guessUpper.length !== solutionUpper.length) {
    throw new Error(`Length mismatch`);
  }
  const tiles = [];
  const solutionChars = solutionUpper.split('');
  const guessChars = guessUpper.split('');
  const used = new Array(solutionChars.length).fill(false);
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === solutionChars[i]) {
      tiles.push({ letter: guessChars[i], state: TileState.CORRECT });
      used[i] = true;
    } else {
      tiles.push({ letter: guessChars[i], state: TileState.ABSENT });
    }
  }
  for (let i = 0; i < guessChars.length; i++) {
    if (tiles[i].state === TileState.CORRECT) continue;
    for (let j = 0; j < solutionChars.length; j++) {
      if (!used[j] && guessChars[i] === solutionChars[j]) {
        tiles[i].state = TileState.PRESENT;
        used[j] = true;
        break;
      }
    }
  }
  const isCorrect = tiles.every(t => t.state === TileState.CORRECT);
  return { tiles, isCorrect };
}

// === seed.ts ===
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function generateSolutionsFromSeed(seed, count) {
  const solutions = [];
  const pool = solutionPoolForDate(getDailySeedDate(seed));
  const solCount = pool.length;
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const seedWithIndex = `${seed}-${i}`;
    let hash = simpleHash(seedWithIndex);
    let attempts = 0;
    while (used.has(hash % solCount) && attempts < solCount) {
      hash = simpleHash(`${seedWithIndex}-${attempts}`);
      attempts++;
    }
    const index = hash % solCount;
    used.add(index);
    solutions.push(pool[index]);
  }
  return solutions;
}

function generateSolutionsFromSeedForLength(seed, count, wordLength) {
  const solutions = [];
  const pool = solutionPoolForLengthAndDate(wordLength, getDailySeedDate(seed));
  const solCount = pool.length;
  const used = new Set();
  for (let i = 0; i < count; i++) {
    const seedWithIndex = `${seed}-${i}`;
    let hash = simpleHash(seedWithIndex);
    let attempts = 0;
    while (used.has(hash % solCount) && attempts < solCount) {
      hash = simpleHash(`${seedWithIndex}-${attempts}`);
      attempts++;
    }
    const index = hash % solCount;
    used.add(index);
    solutions.push(pool[index]);
  }
  return solutions;
}

function generateDailySeed(date, gameMode) { return `daily-${date}-${gameMode}`; }
function isDailySeed(seed) { return seed.startsWith('daily-'); }
function getDailySeedDate(seed) {
  if (!isDailySeed(seed)) return null;
  const parts = seed.split('-');
  return parts.length >= 4 ? `${parts[1]}-${parts[2]}-${parts[3]}` : null;
}

// === prefill.ts ===
function generatePrefillWords(seed, solutions, allowed) {
  const solutionSet = new Set(solutions.map(s => s.toUpperCase()));
  const fiveLetterWords = allowed.filter(w => w.length === 5);
  const pool = fiveLetterWords.length > 0 ? fiveLetterWords : allowed;
  const words = [];
  for (let i = 0; i < 3; i++) {
    let attempt = 0;
    let word;
    do {
      const hashKey = `${seed}-prefill-${i}-${attempt}`;
      const hash = simpleHash(hashKey);
      const index = hash % pool.length;
      word = pool[index];
      attempt++;
    } while (solutionSet.has(word) && attempt < 100);
    words.push(word);
  }
  return words;
}

function generatePrefillGuesses(words, solution) {
  const solutionUpper = solution.toUpperCase();
  return words.map(word => ({
    word,
    evaluation: evaluateGuess(solutionUpper, word),
  }));
}

// === scoring.ts ===
function calculateScore(result) {
  let winBonus = 0, guessDiff = 0, timeDiff = 0, dnfPenalty = 0;
  if (result.playerStatus === GameStatus.WON && result.opponentStatus !== GameStatus.WON) winBonus = 10;
  else if (result.playerStatus !== GameStatus.WON && result.opponentStatus === GameStatus.WON) winBonus = -10;
  if (result.playerStatus === GameStatus.WON && result.opponentStatus === GameStatus.WON) {
    guessDiff = (result.opponentGuesses - result.playerGuesses) * 2;
  }
  if (result.playerStatus === GameStatus.WON && result.opponentStatus === GameStatus.WON) {
    const timeDiffSeconds = (result.opponentTime - result.playerTime) / 1000;
    const timeDiffPoints = Math.floor(timeDiffSeconds / 5);
    timeDiff = Math.max(-10, Math.min(10, timeDiffPoints));
  }
  if (result.playerStatus === GameStatus.LOST || result.playerStatus === GameStatus.ABANDONED) dnfPenalty = -10;
  else if (result.opponentStatus === GameStatus.LOST || result.opponentStatus === GameStatus.ABANDONED) dnfPenalty = 10;
  return { winBonus, guessDiff, timeDiff, dnfPenalty, total: winBonus + guessDiff + timeDiff + dnfPenalty };
}

// ============================================================
// Load real dictionaries
// ============================================================
const allowed = JSON.parse(readFileSync(join(dataDir, 'allowed.json'), 'utf-8'));
const solutions = JSON.parse(readFileSync(join(dataDir, 'solutions.json'), 'utf-8'));
const legacySolutions = JSON.parse(readFileSync(join(dataDir, 'solutions-legacy.json'), 'utf-8'));
const allowed6 = JSON.parse(readFileSync(join(dataDir, 'allowed-6.json'), 'utf-8'));
const solutions6 = JSON.parse(readFileSync(join(dataDir, 'solutions-6.json'), 'utf-8'));
const allowed7 = JSON.parse(readFileSync(join(dataDir, 'allowed-7.json'), 'utf-8'));
const solutions7 = JSON.parse(readFileSync(join(dataDir, 'solutions-7.json'), 'utf-8'));
const legacySolutions6 = JSON.parse(readFileSync(join(dataDir, 'solutions-6-legacy.json'), 'utf-8'));
const legacySolutions7 = JSON.parse(readFileSync(join(dataDir, 'solutions-7-legacy.json'), 'utf-8'));

initDictionary(allowed, solutions, legacySolutions);
initDictionaryForLength(6, allowed6, solutions6, legacySolutions6);
initDictionaryForLength(7, allowed7, solutions7, legacySolutions7);

// ============================================================
// FIXTURE 1: simpleHash parity (most critical)
// ============================================================
const hashFixtures = [];
const hashInputs = [
  '', 'a', 'hello', 'test-seed-123', 'daily-2026-01-15-DUEL',
  'test-0', 'test-1', 'test-2', 'some-seed-42-prefill-0-0',
  'gauntlet-seed-blackout-1', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  '0', '00000', 'zzzzzzzzzzzzzzz',
  // Edge cases for integer overflow behavior
  'a'.repeat(100), 'z'.repeat(50),
];
for (const input of hashInputs) {
  hashFixtures.push({ input, output: simpleHash(input) });
}
writeFileSync(join(outDir, 'hash-fixtures.json'), JSON.stringify(hashFixtures, null, 2));
console.log(`hash-fixtures.json: ${hashFixtures.length} cases`);

// ============================================================
// FIXTURE 2: evaluateGuess
// ============================================================
const evalFixtures = [];
const evalCases = [
  ['HELLO', 'HELLO'],  // all correct
  ['HELLO', 'HXXXX'],  // first correct, rest absent (X not in HELLO)
  ['HELLO', 'OXXXX'],  // O present
  ['HELLO', 'TRAPS'],  // all absent
  ['SPEED', 'EEXXX'],  // duplicate in solution
  ['HELLO', 'LXLXX'],  // duplicate in guess, one correct position
  ['HELLO', 'LLLXX'],  // more L's in guess than solution
  ['CRANE', 'REACT'],  // complex mix
  ['APPLE', 'PAPAL'],  // repeated letters, complex
  ['AABBB', 'BBAAA'],  // heavy overlap, swapped positions
  ['ABBEY', 'BABES'],  // anagram-ish
  ['QUEUE', 'QUEUE'],  // rare letters
  ['FUZZY', 'FIZZY'],  // one-off
  // 6-letter
  ['BRIDGE', 'DANGER'],
  // 7-letter
  ['AMAZING', 'GLAZING'],
];
for (const [solution, guess] of evalCases) {
  evalFixtures.push({ solution, guess, result: evaluateGuess(solution, guess) });
}
writeFileSync(join(outDir, 'evaluator-fixtures.json'), JSON.stringify(evalFixtures, null, 2));
console.log(`evaluator-fixtures.json: ${evalFixtures.length} cases`);

// ============================================================
// FIXTURE 3: generateSolutionsFromSeed (real dictionaries)
// ============================================================
const seedFixtures = [];
const seedCases = [
  { seed: 'test', count: 1 },
  { seed: 'test', count: 4 },
  { seed: 'test', count: 8 },
  // Pre-cutover daily seeds → legacy answer pool (date-gated).
  { seed: 'daily-2026-01-15-DUEL', count: 1 },
  { seed: 'daily-2026-01-15-QUORDLE', count: 4 },
  { seed: 'daily-2026-01-15-OCTORDLE', count: 8 },
  { seed: 'daily-2026-01-15-SEQUENCE', count: 4 },
  { seed: 'daily-2026-01-15-RESCUE', count: 4 },
  // Post-cutover daily seeds → curated answer pool. Locks the gate switch
  // into the cross-engine parity contract (all engines must pick the same
  // pool for a given seed date).
  { seed: 'daily-2026-08-01-DUEL', count: 1 },
  { seed: 'daily-2026-08-01-QUORDLE', count: 4 },
  { seed: 'daily-2026-08-01-OCTORDLE', count: 8 },
  { seed: 'gauntlet-abc-123', count: 21 },  // GAUNTLET_TOTAL_SOLUTIONS = 1+4+4+4+8 = 21
  { seed: 'match-seed-xyz', count: 1 },
  { seed: 'match-seed-xyz', count: 2 },
];
for (const { seed, count } of seedCases) {
  seedFixtures.push({ seed, count, solutions: generateSolutionsFromSeed(seed, count) });
}

// 6/7 letter seeds
const seed6Fixtures = [];
const seed7Fixtures = [];
for (const seed of ['test', 'daily-2026-01-15-DUEL_6', 'match-6-abc', 'daily-2026-08-01-DUEL_6']) {
  seed6Fixtures.push({ seed, count: 1, solutions: generateSolutionsFromSeedForLength(seed, 1, 6) });
}
for (const seed of ['test', 'daily-2026-01-15-DUEL_7', 'match-7-abc', 'daily-2026-08-01-DUEL_7']) {
  seed7Fixtures.push({ seed, count: 1, solutions: generateSolutionsFromSeedForLength(seed, 1, 7) });
}

writeFileSync(join(outDir, 'seed-fixtures.json'), JSON.stringify({ standard: seedFixtures, sixLetter: seed6Fixtures, sevenLetter: seed7Fixtures }, null, 2));
console.log(`seed-fixtures.json: ${seedFixtures.length + seed6Fixtures.length + seed7Fixtures.length} cases`);

// ============================================================
// FIXTURE 4: scoring
// ============================================================
const scoringFixtures = [];
const scoringCases = [
  // Both won, player faster and fewer guesses
  { playerWon: true, playerGuesses: 3, opponentGuesses: 5, playerTime: 30000, opponentTime: 60000, playerStatus: 'WON', opponentStatus: 'WON' },
  // Both won, opponent faster
  { playerWon: true, playerGuesses: 4, opponentGuesses: 4, playerTime: 60000, opponentTime: 30000, playerStatus: 'WON', opponentStatus: 'WON' },
  // Player won, opponent lost
  { playerWon: true, playerGuesses: 4, opponentGuesses: 6, playerTime: 45000, opponentTime: 120000, playerStatus: 'WON', opponentStatus: 'LOST' },
  // Player lost, opponent won
  { playerWon: false, playerGuesses: 6, opponentGuesses: 3, playerTime: 120000, opponentTime: 30000, playerStatus: 'LOST', opponentStatus: 'WON' },
  // Player abandoned
  { playerWon: false, playerGuesses: 2, opponentGuesses: 4, playerTime: 15000, opponentTime: 60000, playerStatus: 'ABANDONED', opponentStatus: 'WON' },
  // Both lost (draw-ish)
  { playerWon: false, playerGuesses: 6, opponentGuesses: 6, playerTime: 120000, opponentTime: 120000, playerStatus: 'LOST', opponentStatus: 'LOST' },
];
for (const c of scoringCases) {
  const result = {
    playerWon: c.playerWon,
    playerGuesses: c.playerGuesses,
    opponentGuesses: c.opponentGuesses,
    playerTime: c.playerTime,
    opponentTime: c.opponentTime,
    playerStatus: c.playerStatus,
    opponentStatus: c.opponentStatus,
    score: { winBonus: 0, guessDiff: 0, timeDiff: 0, dnfPenalty: 0, total: 0 },
  };
  const score = calculateScore(result);
  scoringFixtures.push({ input: c, output: score });
}
writeFileSync(join(outDir, 'scoring-fixtures.json'), JSON.stringify(scoringFixtures, null, 2));
console.log(`scoring-fixtures.json: ${scoringFixtures.length} cases`);

// ============================================================
// FIXTURE 5: prefill (for Rescue/Deliverance mode)
// ============================================================
const prefillFixtures = [];
const prefillCases = [
  { seed: 'test', solutions: generateSolutionsFromSeed('test', 4) },
  { seed: 'daily-2026-01-15-RESCUE', solutions: generateSolutionsFromSeed('daily-2026-01-15-RESCUE', 4) },
];
for (const { seed, solutions: sols } of prefillCases) {
  const prefillWords = generatePrefillWords(seed, sols, getAllowedWords());
  const boardPrefills = sols.map(sol => ({
    solution: sol,
    prefillGuesses: generatePrefillGuesses(prefillWords, sol),
  }));
  prefillFixtures.push({ seed, solutions: sols, prefillWords, boardPrefills });
}
writeFileSync(join(outDir, 'prefill-fixtures.json'), JSON.stringify(prefillFixtures, null, 2));
console.log(`prefill-fixtures.json: ${prefillFixtures.length} cases`);

// ============================================================
// FIXTURE 6: daily seed helpers
// ============================================================
const dailySeedFixtures = {
  generate: [
    { date: '2026-01-15', mode: 'DUEL', expected: generateDailySeed('2026-01-15', 'DUEL') },
    { date: '2026-06-01', mode: 'QUORDLE', expected: generateDailySeed('2026-06-01', 'QUORDLE') },
    { date: '2025-12-31', mode: 'GAUNTLET', expected: generateDailySeed('2025-12-31', 'GAUNTLET') },
  ],
  isDaily: [
    { seed: 'daily-2026-01-15-DUEL', expected: true },
    { seed: 'match-123-abc', expected: false },
    { seed: 'daily-', expected: true },
    { seed: 'not-daily', expected: false },
  ],
};
writeFileSync(join(outDir, 'daily-seed-fixtures.json'), JSON.stringify(dailySeedFixtures, null, 2));
console.log(`daily-seed-fixtures.json: ${dailySeedFixtures.generate.length + dailySeedFixtures.isDaily.length} cases`);

console.log(`\nAll fixtures written to ${outDir}`);
