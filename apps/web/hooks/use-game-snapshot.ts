'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GameState,
  GameStatus,
  GameMode,
  TileState,
  type TileResult,
  gameReducer,
  createInitialState,
  isDailySeed,
} from '@wordle-duel/core';
import { getTodayLocal } from '@/lib/daily-service';
import { supabase } from '@/lib/supabase-client';

// Full-state snapshot persistence shared by every reducer-based game mode.
// Unlike a flat guess-replay approach, this serializes the entire reducer
// state so multi-board and multi-stage modes (Gauntlet especially) can
// resume mid-game exactly where the player left off without rerunning
// dictionary lookups or prefill generation.
//
// Bump SAVE_VERSION when the core GameState shape changes so old saves are
// discarded instead of being restored into an incompatible reducer.
const SAVE_VERSION = 1;
const PRACTICE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
// A game started close to local midnight can cross the day boundary.
// Rather than wipe in-flight progress the instant the clock ticks over,
// keep yesterday's daily save loadable for this grace window — long
// enough to let the player finish, short enough that tomorrow's puzzle
// takes over for anyone who walks away and comes back later in the day.
const DAILY_CROSS_MIDNIGHT_GRACE_MS = 4 * 60 * 60 * 1000; // 4h

function getStorageKey(mode: GameMode, isDaily: boolean): string {
  return `wordocious-session-${mode}-${isDaily ? 'daily' : 'practice'}`;
}

interface SavedSession {
  version: number;
  date: string;      // YYYY-MM-DD at save time
  mode: GameMode;
  isDaily: boolean;
  seed: string;
  elapsedTime: number;
  savedAt: number;
  state: GameState;
}

export interface RestoredSession {
  seed: string;
  state: GameState;
  elapsedTime: number;
  /** True if the saved state was already terminal (WON/LOST/ABANDONED).
   *  Callers use this to suppress victory animations and duplicate stat
   *  recording when a completed game is loaded back in on navigate-return. */
  isCompleted: boolean;
}

/**
 * Look up a previously saved game session for this mode + mode-variant
 * (daily vs practice). Returns null if:
 * - No session saved
 * - Save is from a different version or game mode
 * - Daily: save is from a different UTC day
 * - Practice: save is older than the 24h TTL
 *
 * Terminal saves (WON/LOST/ABANDONED) ARE returned so that navigating
 * back to a completed daily shows the finished board instead of a fresh
 * one. Callers check `isCompleted` to gate re-triggering animations and
 * stat recording.
 *
 * Daily and practice have separate storage keys so a mid-game practice
 * session can't leak into daily and vice versa.
 *
 * Callers are expected to invoke this from a lazy initializer so the result
 * is stable across re-renders.
 */
export function loadGameSession(mode: GameMode, isDaily: boolean): RestoredSession | null {
  if (typeof window === 'undefined') return null;
  const key = getStorageKey(mode, isDaily);
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const parsed: SavedSession = JSON.parse(stored);

    if (parsed.version !== SAVE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.mode !== mode) {
      localStorage.removeItem(key);
      return null;
    }
    if (parsed.isDaily !== isDaily) {
      // Key should prevent this, but double-check in case a user manually
      // copies storage across keys.
      return null;
    }
    if (isDaily) {
      const today = getTodayLocal(); // now returns local day
      if (parsed.date !== today) {
        // Cross-midnight grace: if this save is from yesterday but the
        // user reopened within the grace window, AND the save is still
        // in-progress (PLAYING), keep it so they can finish. Completed
        // saves past midnight are discarded — tomorrow's puzzle wins.
        const stillPlaying = parsed.state.status === GameStatus.PLAYING;
        const withinGrace = Date.now() - parsed.savedAt < DAILY_CROSS_MIDNIGHT_GRACE_MS;
        if (!stillPlaying || !withinGrace) {
          localStorage.removeItem(key);
          return null;
        }
      }
    } else {
      if (Date.now() - parsed.savedAt > PRACTICE_TTL_MS) {
        localStorage.removeItem(key);
        return null;
      }
    }
    if (parsed.state.mode !== mode) {
      localStorage.removeItem(key);
      return null;
    }

    // Gauntlet-specific salvage path for saves that predate the Letter
    // Blackout removal. Those saves look like mid-game sessions (status
    // PLAYING) because the old reducer kept the game alive even after a
    // board failure — it replaced the failed board with a fresh seed and
    // bumped `blackoutCount`. The run should instead have ended the
    // instant that first board hit max-guesses. Rewrite the state to
    // LOST here and inject a failed GauntletStageResult for the current
    // stage so GauntletResults can show the player where they died and
    // the game-over effect can record the loss via the normal path.
    // Keep `isCompleted: false` so the post-restore recording effect
    // isn't gated off as "already handled."
    const restoredState = parsed.state;
    if (
      restoredState.mode === GameMode.GAUNTLET &&
      restoredState.gauntlet &&
      restoredState.gauntlet.blackoutCount > 0 &&
      restoredState.status === GameStatus.PLAYING
    ) {
      const stageGuesses = restoredState.boards.reduce(
        (max, b) => Math.max(max, b.guesses.length),
        0,
      );
      const stageTimeMs = Date.now() - restoredState.gauntlet.stageStartTime;
      const alreadyRecorded = restoredState.gauntlet.stageResults.some(
        r => r.stageIndex === restoredState.gauntlet!.currentStage,
      );
      const salvagedState = {
        ...restoredState,
        status: GameStatus.LOST,
        gauntlet: {
          ...restoredState.gauntlet,
          stageResults: alreadyRecorded
            ? restoredState.gauntlet.stageResults
            : [
                ...restoredState.gauntlet.stageResults,
                {
                  stageIndex: restoredState.gauntlet.currentStage,
                  status: GameStatus.LOST,
                  guesses: stageGuesses,
                  timeMs: stageTimeMs,
                  // Capture the failed stage's final boards so the
                  // GauntletResults Review modal can show where the run
                  // ended. Same treatment the live reducer now applies;
                  // this keeps salvaged sessions on parity.
                  boardsSnapshot: restoredState.boards,
                },
              ],
        },
      };
      return {
        seed: parsed.seed,
        state: salvagedState,
        elapsedTime: parsed.elapsedTime,
        isCompleted: false,
      };
    }

    // Retroactive boardsSnapshot backfill for Gauntlet saves that
    // completed before the snapshot landed on GauntletStageResult. The
    // failed stage's boards are still sitting in state.boards — on a
    // LOST Gauntlet we never fire NEXT_STAGE, so restoredState.boards
    // still matches the stage that ended the run. Patch those onto the
    // last stage result so its Review row becomes tappable without
    // requiring the player to start a fresh run to see the feature.
    // Stages the player had already cleared were replaced by
    // NEXT_STAGE's next-stage boards under the old reducer and can't
    // be reconstructed; those rows stay non-tappable on legacy saves.
    if (
      restoredState.mode === GameMode.GAUNTLET &&
      restoredState.gauntlet &&
      restoredState.status === GameStatus.LOST &&
      restoredState.gauntlet.stageResults.length > 0
    ) {
      const idx = restoredState.gauntlet.stageResults.length - 1;
      const last = restoredState.gauntlet.stageResults[idx];
      if (
        last.status === GameStatus.LOST &&
        !last.boardsSnapshot?.length &&
        restoredState.boards.length > 0
      ) {
        const patchedStageResults = [...restoredState.gauntlet.stageResults];
        patchedStageResults[idx] = { ...last, boardsSnapshot: restoredState.boards };
        return {
          seed: parsed.seed,
          state: {
            ...restoredState,
            gauntlet: {
              ...restoredState.gauntlet,
              stageResults: patchedStageResults,
            },
          },
          elapsedTime: parsed.elapsedTime,
          isCompleted: parsed.state.status !== GameStatus.PLAYING,
        };
      }
    }

    return {
      seed: parsed.seed,
      state: parsed.state,
      elapsedTime: parsed.elapsedTime,
      isCompleted: parsed.state.status !== GameStatus.PLAYING,
    };
  } catch {
    try { localStorage.removeItem(key); } catch {}
    return null;
  }
}

function saveGameSession(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  state: GameState,
  elapsedTime: number,
): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: SavedSession = {
      version: SAVE_VERSION,
      date: getTodayLocal(),
      mode,
      isDaily,
      seed,
      elapsedTime,
      savedAt: Date.now(),
      state,
    };
    localStorage.setItem(getStorageKey(mode, isDaily), JSON.stringify(payload));
  } catch {
    // localStorage quota / private mode — skip silently
  }
}

export function clearGameSession(mode: GameMode, isDaily: boolean): void {
  if (typeof window === 'undefined') return;
  try { localStorage.removeItem(getStorageKey(mode, isDaily)); } catch {}
}

/**
 * Hook that keeps a game session saved to localStorage. Save triggers on
 * every state or elapsedTime change, including terminal transitions so a
 * user who navigates away after winning can return and see the finished
 * board (with `isCompleted=true` to suppress re-animating). Defers the
 * first save by one tick so a freshly-loaded session isn't immediately
 * overwritten by an identical snapshot.
 *
 * Save cleanup is handled passively by date/TTL gating in {@link loadGameSession}
 * — next-day loads on daily and 24h+ loads on practice return null and
 * purge the key at that point.
 *
 * Use alongside {@link loadGameSession} to restore state on mount:
 *
 * ```ts
 * const [savedSession] = useState(() => loadGameSession(mode, isDaily));
 * const [seed] = useState(() => savedSession?.seed ?? generateSeed());
 * const [state, dispatch] = useReducer(
 *   gameReducer,
 *   seed,
 *   (s) => savedSession?.state ?? createInitialState(s, mode),
 * );
 * const { elapsedSeconds: elapsedTime } = useActivePlayTimer(
 *   state.status === GameStatus.PLAYING,
 *   savedSession?.elapsedTime ?? 0,
 * );
 * useGameSnapshot(mode, isDaily, seed, state, elapsedTime);
 * ```
 */
// ---------------------------------------------------------------------------
// Server-replay fallback (cross-device daily restore)
// ---------------------------------------------------------------------------
//
// A daily played on the native app (or another browser) has no localStorage
// snapshot here, so clicking the completed mode card used to start a fresh
// board. The matches table already stores everything needed to rebuild the
// finished game: the daily seed + the ordered player1_guesses. Mirroring the
// native implementation, we regenerate the initial state from the seed
// (which also re-creates Deliverance prefills) and replay the recorded
// guesses through the same gameReducer that produced them.

/** Modes whose live UI submits each guess to every PLAYING board at once. */
const PARALLEL_MULTI_BOARD_MODES: ReadonlySet<GameMode> = new Set([
  GameMode.QUORDLE,
  GameMode.OCTORDLE,
  GameMode.RESCUE,
]);

/** Hard cap on replay iterations — defends against corrupt rows. */
const REPLAY_MAX_ITERATIONS = 200;

/**
 * Rebuild a finished GameState by replaying recorded guesses through the
 * reducer. Returns null when the replay doesn't reach a terminal state
 * (corrupt/mismatched data) so callers fall back to a fresh board instead
 * of resurrecting a half-broken one.
 *
 * - Parallel multi-board modes (QuadWord/OctoWord/Deliverance) replay with
 *   applyToAll, matching how their UIs dispatch live guesses.
 * - Sequence records a flat per-board concatenation, so each guess is
 *   applied to the first still-PLAYING board, which reproduces the exact
 *   per-board guess lists.
 * - Classic Six/Seven hint rows are stored verbatim in the guess list as
 *   space-padded words (e.g. "  A  "); they fail dictionary validation, so
 *   they're replayed via SUBMIT_HINT with the evaluation rebuilt from the
 *   row itself (revealed positions CORRECT, the rest HINT_USED).
 */
export function replayRecordedGuesses(
  mode: GameMode,
  seed: string,
  recordedGuesses: string[],
): GameState | null {
  let state = createInitialState(seed, mode);
  const applyToAll = PARALLEL_MULTI_BOARD_MODES.has(mode);

  let iterations = 0;
  for (const raw of recordedGuesses) {
    if (++iterations > REPLAY_MAX_ITERATIONS) break;
    if (state.status !== GameStatus.PLAYING) break;
    const guess = String(raw ?? '').toUpperCase();
    if (!guess) continue;

    if (/[^A-Z]/.test(guess)) {
      // Hint row (Six/Seven only). The recorded string carries the revealed
      // letter with the other slots padded ("  A   "). Derive the revealed
      // POSITIONS from the solution rather than trusting the string's padding:
      // a row recorded left-aligned ("A     ") — the legacy shape that caused
      // the original slot-0 hint bug — would otherwise replay a CORRECT tile at
      // slot 0 and render the hint in the wrong column. Mirrors
      // useClassicHints' buildHintRow: EVERY occurrence of the revealed letter
      // is CORRECT, everything else HINT_USED.
      const board = state.boards[state.currentBoardIndex];
      const solutionUpper = (board?.solution ?? '').toUpperCase();
      const revealed = new Set(guess.replace(/[^A-Z]/g, ''));
      const derived = [...solutionUpper].map(ch => revealed.has(ch));
      const usable = solutionUpper.length > 0 && derived.some(Boolean);

      const tiles: TileResult[] = usable
        ? [...solutionUpper].map((ch, i) =>
            derived[i]
              ? { letter: ch, state: TileState.CORRECT }
              : { letter: ' ', state: TileState.HINT_USED },
          )
        // Unmatchable row (corrupt data — a real hint only ever reveals a
        // letter that IS in the answer): fall back to the recorded positions,
        // which is no worse than the previous behaviour.
        : [...guess].map(ch =>
            /[A-Z]/.test(ch)
              ? { letter: ch, state: TileState.CORRECT }
              : { letter: ' ', state: TileState.HINT_USED },
          );
      // Re-derive the stored word too, so board.guesses agrees with the tiles.
      const hintWord = tiles.map(t => (t.state === TileState.CORRECT ? t.letter : ' ')).join('');

      state = gameReducer(state, {
        type: 'SUBMIT_HINT',
        hintWord,
        hintEvaluation: { tiles, isCorrect: false },
      });
    } else if (mode === GameMode.SEQUENCE) {
      const activeIndex = state.boards.findIndex(b => b.status === GameStatus.PLAYING);
      if (activeIndex < 0) break;
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess, boardIndex: activeIndex });
    } else {
      state = gameReducer(state, { type: 'SUBMIT_GUESS', guess, applyToAll });
    }
  }

  return state.status !== GameStatus.PLAYING ? state : null;
}

/**
 * Async second-phase restore for daily games played on another device.
 *
 * Runs ONLY when: signed-in user + daily seed + no local snapshot. Fetches
 * the user's newest matches row for this seed, replays the recorded guesses,
 * and hands the rebuilt {@link RestoredSession} to `onRestore`, where the
 * component dispatches RESTORE_STATE and flags itself as restored-completed
 * — the exact path a local terminal snapshot takes, so the normal post-game
 * UI renders and the record-on-finish effects stay suppressed.
 *
 * `liveState` is read through a ref at resolve time: if the user started
 * guessing on the fresh board while the fetch was in flight, the restore is
 * dropped rather than clobbering their input.
 */
export function useServerDailyReplay(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  userId: string | undefined,
  hasLocalSession: boolean,
  liveState: GameState,
  onRestore: (session: RestoredSession) => void,
): void {
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;
  const liveStateRef = useRef(liveState);
  liveStateRef.current = liveState;
  const attemptedRef = useRef(false);

  useEffect(() => {
    if (attemptedRef.current) return;
    if (!isDaily || hasLocalSession || !userId || !isDailySeed(seed)) return;
    attemptedRef.current = true;

    let cancelled = false;
    (async () => {
      try {
        const { data } = await (supabase as any)
          .from('matches')
          .select('player1_guesses, player1_time')
          .eq('player1_id', userId)
          .eq('seed', seed)
          .order('created_at', { ascending: false })
          .limit(1);
        const row = data?.[0];
        if (cancelled || !row) return;
        const guesses: string[] = Array.isArray(row.player1_guesses) ? row.player1_guesses : [];
        if (guesses.length === 0) return;

        const state = replayRecordedGuesses(mode, seed, guesses);
        if (cancelled || !state) return;
        // User typed on the fresh board while we were fetching — keep theirs.
        if (liveStateRef.current.boards.some(b => b.guesses.length > 0)) return;

        onRestoreRef.current({
          seed,
          state,
          elapsedTime: Math.max(0, Math.round(Number(row.player1_time) || 0)),
          isCompleted: true,
        });
      } catch {
        // Offline / RLS / transient error — fall back to a fresh board.
      }
    })();
    return () => { cancelled = true; };
  }, [mode, isDaily, seed, userId, hasLocalSession]);
}

export function useGameSnapshot(
  mode: GameMode,
  isDaily: boolean,
  seed: string,
  state: GameState,
  elapsedTime: number,
): void {
  const hasMounted = useRef(false);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (state.mode !== mode) return;
    saveGameSession(mode, isDaily, seed, state, elapsedTime);
  }, [mode, isDaily, seed, state, elapsedTime]);

  // `beforeunload` flush: React state updates from a just-submitted
  // guess may not have flushed through the effect above before the user
  // force-closes the tab. Write the latest known snapshot synchronously
  // on unload so that one-last-guess scenario isn't lost.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (state.mode !== mode) return;
    const onBeforeUnload = () => {
      saveGameSession(mode, isDaily, seed, state, elapsedTime);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [mode, isDaily, seed, state, elapsedTime]);
}
