import { describe, it, expect } from 'vitest';
import { GameMode, GameStatus, generateDailySeed, createInitialState } from '@wordle-duel/core';
import { replayRecordedGuesses } from './use-game-snapshot';
import { ensureDictionaryInitialized } from '@/lib/init-dictionary';

// The app initializes dictionaries at boot; the replay needs them to seed a board.
ensureDictionaryInitialized();

/**
 * Guards the Six/Seven half of a bug class that has bitten three times: a
 * completed-daily card pairing a hint row's LETTER with a different tile's
 * COLOR. The card renders `hintEvaluations` tiles, so a hint must replay with
 * its revealed letter at the answer's real positions no matter how the row was
 * recorded. Mirrors `singleDisplayGuesses` in completed-daily-board.tsx.
 */
function displayGuesses(board: { guesses: string[]; hintEvaluations?: Record<number, any> }) {
  return board.guesses.map((g, i) => {
    const he = board.hintEvaluations?.[i];
    return he ? he.tiles.map((t: any) => (t.letter && t.letter !== ' ' ? t.letter : ' ')).join('') : g;
  });
}

const correctIdxs = (he: any): number[] =>
  he.tiles.map((t: any, i: number) => (t.state === 'CORRECT' ? i : -1)).filter((i: number) => i >= 0);

describe.each([
  ['Six', GameMode.DUEL_6],
  ['Seven', GameMode.DUEL_7],
])('%s — recorded hint-row replay', (_label, mode) => {
  const seed = generateDailySeed('2026-07-16', mode as GameMode);
  const solution = createInitialState(seed, mode as GameMode).boards[0].solution.toUpperCase();
  // A letter that appears exactly once, so its expected slot is unambiguous.
  const letter = [...solution].find((c, i) => solution.indexOf(c) === solution.lastIndexOf(c) && i > 0)!;
  const truth = [...solution].map((c, i) => (c === letter ? i : -1)).filter(i => i >= 0);
  const positioned = [...solution].map(c => (c === letter ? c : ' ')).join('');

  it('positioned row (the shape every writer emits today) keeps its slot', () => {
    const state = replayRecordedGuesses(mode as GameMode, seed, [positioned, solution])!;
    const board = state.boards[0];
    expect(correctIdxs(board.hintEvaluations![0])).toEqual(truth);
    truth.forEach(i => expect(displayGuesses(board)[0][i]).toBe(letter));
  });

  it('legacy LEFT-ALIGNED row is corrected, not rendered at slot 0', () => {
    // The shape daf8eb1 cites as the origin of the original slot-0 hint bug.
    const state = replayRecordedGuesses(mode as GameMode, seed, [letter + ' '.repeat(solution.length - 1), solution])!;
    const board = state.boards[0];
    expect(correctIdxs(board.hintEvaluations![0])).toEqual(truth);
    const display = displayGuesses(board)[0];
    truth.forEach(i => expect(display[i]).toBe(letter));
    if (!truth.includes(0)) expect(display[0]).toBe(' ');
    // The stored word is re-derived too, so guesses agree with the tiles.
    expect(board.guesses[0]).toBe(positioned);
  });

  it('a repeated revealed letter marks EVERY occurrence', () => {
    const dup = [...solution].find((c, i) => solution.indexOf(c) !== i);
    if (!dup) return; // today's word has no repeat — nothing to assert
    const all = [...solution].map((c, i) => (c === dup ? i : -1)).filter(i => i >= 0);
    const state = replayRecordedGuesses(mode as GameMode, seed, [dup + ' '.repeat(solution.length - 1), solution])!;
    expect(correctIdxs(state.boards[0].hintEvaluations![0])).toEqual(all);
  });

  it('unmatchable row (letter not in the answer) falls back without crashing', () => {
    const missing = [...'QXZJ'].find(c => !solution.includes(c))!;
    const state = replayRecordedGuesses(mode as GameMode, seed, [' ' + missing + ' '.repeat(solution.length - 2), solution]);
    expect(state).not.toBeNull();
    expect(correctIdxs(state!.boards[0].hintEvaluations![0])).toEqual([1]);
  });

  it('counts the hint (summary must not claim "No hints")', () => {
    const state = replayRecordedGuesses(mode as GameMode, seed, [positioned, solution])!;
    expect(Object.keys(state.boards[0].hintEvaluations ?? {}).length).toBe(1);
  });

  it('leaves a normal guess untouched by the hint branch', () => {
    const state = replayRecordedGuesses(mode as GameMode, seed, [solution])!;
    expect(state.status).toBe(GameStatus.WON);
    expect(displayGuesses(state.boards[0])[0]).toBe(solution);
    expect(Object.keys(state.boards[0].hintEvaluations ?? {}).length).toBe(0);
  });
});
