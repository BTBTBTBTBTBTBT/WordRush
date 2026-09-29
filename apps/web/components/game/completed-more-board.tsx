'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  generateDailySeed, ladderPuzzleForDay, hubPuzzleForDay, crosswordPuzzleForDay, scramblePuzzleForDay, wordsearchPuzzleForDay,
  type LadderBank, type HubBank, type CrosswordBank, type ScrambleBank, type ScramblePuzzle, type WordsearchBank,
  type SudokuState, type RegionsState, type LadderState, type HubState, type CryptogramState, type GroupsGroup,
  type CrosswordState, type ScrambleState, type WordsearchState,
} from '@wordle-duel/core';
import { MODES, MODE_BY_DBKEY } from '@/lib/modes.generated';
import { MODE_SCORE_CONFIG } from '@/lib/composite-scoring';
import { formatGuessStat } from '@/lib/format';
import { HOLIDAY_TABLE } from '@/lib/holidays';
import { useAuth } from '@/lib/auth-context';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { fetchSolvedDailyRow, getTodayLocal, type DailyCompletion, type SolvedDailyRow } from '@/lib/daily-service';
import {
  sudokuElsewhere, regionsElsewhere, ladderElsewhere, hubElsewhere, cryptogramElsewhere, groupsElsewhere, crosswordElsewhere,
  scrambleElsewhere, wordsearchElsewhere, type ElsewhereDaily, type ElsewhereProgress,
} from '@/lib/elsewhere-progress';
import { CollapsibleCompletedCard } from '@/components/game/collapsible-completed-card';
import { ScoreBreakdownCard } from '@/components/game/score-breakdown';
import { SudokuBoard } from '@/components/sudoku/sudoku-board';
import { RegionsBoard } from '@/components/regions/regions-board';
import { LadderBoard } from '@/components/ladder/ladder-board';
import { SpyglassGrid, SpyglassWordList } from '@/components/wordsearch/spyglass-grid';
import { HubRankBar, HubAllWordChips } from '@/components/hub/hub-finished';
import { CipherBoard } from '@/components/cryptogram/cipher-board';
import { CIPHER_CELL_MIN } from '@/components/cryptogram/cipher-layout';
import { GroupBar } from '@/components/groups/groups-board';
import { CrosswordBoard, ClueColumns } from '@/components/crossword/crossword-board';
import { CartoonPanel, WordRow, FinalRow, MUDDLE_ACCENT, COLUMN_CLASS } from '@/components/scramble/muddle-board';

// Founder, 2026-09-29: the Leaderboard / Records "Completed today" card showed
// "Loading board…" forever for the More Games titles — CompletedDailyBoard only
// knew word boards. This card rebuilds today's finished board from the matches
// row with the same *Elsewhere helpers (and board components) each game uses
// for "finished on another device", so it matches what the game itself shows.
// The puzzle banks load lazily, only for the title on screen.

/** Custom-engine dailies with a board rebuilt here (ProperNoundle keeps its own branch). */
const MORE_BOARD_KEYS = new Set(
  MODES.filter((m) => m.engine === 'custom' && m.dbKey && m.dbKey !== 'PROPERNOUNDLE').map((m) => m.dbKey as string),
);
export const isMoreBoardMode = (dbKey: string) => MORE_BOARD_KEYS.has(dbKey);

/** How long the card may say "Loading board…" before it settles on the summary alone. */
const LOAD_BOUND_MS = 8000;

type MoreBoard =
  | { kind: 'SUDOKU'; state: SudokuState }
  | { kind: 'REGIONS'; state: RegionsState }
  | { kind: 'LADDER'; state: LadderState }
  | { kind: 'WORDSEARCH'; state: WordsearchState }
  | { kind: 'HUB'; state: HubState }
  | { kind: 'CRYPTOGRAM'; state: CryptogramState }
  | { kind: 'GROUPS'; solved: GroupsGroup[]; unsolved: GroupsGroup[] }
  | { kind: 'CROSSWORD'; state: CrosswordState }
  | { kind: 'SCRAMBLE'; state: ScrambleState; puzzle: ScramblePuzzle };

interface Built { progress: ElsewhereProgress | null; board: MoreBoard | null }
const NOTHING: Built = { progress: null, board: null };

// ── Row fetch: one request per (user, day, mode, recorded result), shared by
// every mount; a day-keyed localStorage copy paints revisits at once (§254).
// The recorded result is part of the key because Hubbub's row moves with each
// later rank-up.
const rowRequests = new Map<string, Promise<SolvedDailyRow | null>>();
const rowStoreKey = (dbKey: string) => `wordocious-completed-more-row:${dbKey}`;
const resultSig = (c: DailyCompletion) => `${c.won ? 1 : 0}|${c.guesses}|${c.timeSeconds}`;

function readStoredRow(dbKey: string, id: string): SolvedDailyRow | null {
  try {
    const p = JSON.parse(localStorage.getItem(rowStoreKey(dbKey)) ?? 'null');
    return p && p.id === id && p.row && Array.isArray(p.row.solutions) ? (p.row as SolvedDailyRow) : null;
  } catch { return null; }
}

function loadRow(userId: string, dbKey: string, day: string, id: string): Promise<SolvedDailyRow | null> {
  const stored = readStoredRow(dbKey, id);
  if (stored) return Promise.resolve(stored);
  let p = rowRequests.get(id);
  if (!p) {
    p = fetchSolvedDailyRow(userId, dbKey, generateDailySeed(day, dbKey)).then(
      (row) => {
        if (row) { try { localStorage.setItem(rowStoreKey(dbKey), JSON.stringify({ id, row })); } catch {} }
        else rowRequests.delete(id);   // not written yet: the next mount asks again
        return row;
      },
      () => { rowRequests.delete(id); return null; },
    );
    rowRequests.set(id, p);
  }
  return p;
}

async function buildMoreBoard(dbKey: string, row: SolvedDailyRow, d: ElsewhereDaily, day: string): Promise<Built> {
  switch (dbKey) {
    case 'SUDOKU': {
      const r = sudokuElsewhere(row, d);
      return { progress: r.progress, board: r.state ? { kind: 'SUDOKU', state: r.state } : null };
    }
    case 'REGIONS': {
      const r = regionsElsewhere(row, d);
      return { progress: r.progress, board: r.state ? { kind: 'REGIONS', state: r.state } : null };
    }
    case 'LADDER': {
      const bank = (await import('@/data/ladder-puzzles.json')).default as unknown as LadderBank;
      const r = ladderElsewhere(row, d, ladderPuzzleForDay(bank, day)?.id);
      return { progress: r.progress, board: r.state ? { kind: 'LADDER', state: r.state } : null };
    }
    case 'HUB': {
      const bank = (await import('@/data/hub-puzzles.json')).default as unknown as HubBank;
      const r = hubElsewhere(row, d, hubPuzzleForDay(bank, day));
      return { progress: r.progress, board: r.state ? { kind: 'HUB', state: r.state } : null };
    }
    case 'CRYPTOGRAM': {
      const r = cryptogramElsewhere(row, d);
      return { progress: r.progress, board: r.state ? { kind: 'CRYPTOGRAM', state: r.state } : null };
    }
    case 'GROUPS': {
      const r = groupsElsewhere(row, d);
      return { progress: r.progress, board: r.solved.length || r.unsolved.length ? { kind: 'GROUPS', solved: r.solved, unsolved: r.unsolved } : null };
    }
    case 'CROSSWORD': {
      const bank = (await import('@/data/crossword-puzzles.json')).default as unknown as CrosswordBank;
      const r = crosswordElsewhere(row, d, crosswordPuzzleForDay(bank, day, HOLIDAY_TABLE));
      return { progress: r.progress, board: r.state ? { kind: 'CROSSWORD', state: r.state } : null };
    }
    case 'SCRAMBLE': {
      const bank = (await import('@/data/scramble-puzzles.json')).default as unknown as ScrambleBank;
      const puzzle = scramblePuzzleForDay(bank, day, HOLIDAY_TABLE);
      const r = scrambleElsewhere(row, d, puzzle);
      return { progress: r.progress, board: r.state && puzzle ? { kind: 'SCRAMBLE', state: r.state, puzzle } : null };
    }
    case 'WORDSEARCH': {
      const bank = (await import('@/data/wordsearch-puzzles.json')).default as unknown as WordsearchBank;
      const p = wordsearchPuzzleForDay(bank, day);
      if (!p) return NOTHING;
      const state = wordsearchElsewhere(row, d, p);
      return { progress: { boardsSolved: state.found.length, totalBoards: state.words.length, hintsUsed: state.hintsUsed }, board: { kind: 'WORDSEARCH', state } };
    }
    default:
      return NOTHING;
  }
}

const noop = () => {};
/** The board is a picture here: no taps, no focus stops (React 18 has no `inert` prop). */
const makeInert = (el: HTMLDivElement | null) => { if (el) el.setAttribute('inert', ''); };

/** The finished board the game shows, scaled to the card with CSS zoom (fonts and borders scale with it);
 *  zoomed wrappers stretch so the boards' own max widths set the size. */
function FinishedMoreBoard({ board, won }: { board: MoreBoard; won: boolean }) {
  let body: ReactNode;
  switch (board.kind) {
    case 'SUDOKU':
      body = <div className="self-stretch" style={{ zoom: 0.62 }}><SudokuBoard state={board.state} selected={null} onSelect={noop} revealSolution={!won} /></div>;
      break;
    case 'REGIONS':
      body = <div className="self-stretch" style={{ zoom: 0.62 }}><RegionsBoard state={board.state} focused={null} onTap={noop} revealSolution={!won} /></div>;
      break;
    case 'LADDER':
      body = <div className="self-stretch" style={{ zoom: 0.75 }}><LadderBoard state={board.state} typing="" invalid={false} shaking={false} revealPath={!won} /></div>;
      break;
    case 'WORDSEARCH':
      body = (
        <>
          <div className="self-stretch" style={{ zoom: 0.62 }}><SpyglassGrid state={board.state} onSelect={noop} disabled revealMissing={!won} /></div>
          <div className="self-stretch" style={{ zoom: 0.8 }}><SpyglassWordList state={board.state} done /></div>
        </>
      );
      break;
    case 'HUB':
      body = (
        <>
          <HubRankBar state={board.state} />
          <div className="w-full max-w-md mx-auto">
            <div className="text-[10px] font-black tracking-wider mb-1 text-center" style={{ color: 'var(--color-text-muted)' }}>ALL WORDS</div>
            <div className="flex flex-wrap justify-center gap-1.5"><HubAllWordChips state={board.state} /></div>
          </div>
        </>
      );
      break;
    case 'CRYPTOGRAM':
      body = (
        <>
          <CipherBoard state={board.state} selected={null} onSelect={noop} finished cell={CIPHER_CELL_MIN} />
          <p className="text-center text-sm font-extrabold" style={{ color: 'var(--color-text)' }}>“{board.state.text}”</p>
        </>
      );
      break;
    case 'GROUPS':
      body = (
        <div className="flex flex-col items-center gap-1.5 w-full">
          {board.solved.map((g) => <GroupBar key={g.tier} group={g} />)}
          {board.unsolved.map((g) => <GroupBar key={g.tier} group={g} revealed />)}
        </div>
      );
      break;
    case 'CROSSWORD':
      body = (
        <>
          <CrosswordBoard state={board.state} selected={null} activeCells={[]} onSelect={noop} finished cell={26} />
          <div className="self-stretch" style={{ zoom: 0.8 }}><ClueColumns state={board.state} activeEntry={null} onPick={noop} finished /></div>
        </>
      );
      break;
    case 'SCRAMBLE': {
      const es = board.state;
      const caption = es.caption.split('____');
      body = (
        <>
          <div className="self-stretch flex flex-col items-center" style={{ height: 140 }}>
            <CartoonPanel src={board.puzzle.cartoon ?? null} alt={board.puzzle.altText ?? 'Cartoon'} />
          </div>
          <p className="text-center font-extrabold px-1" style={{ fontSize: 13, lineHeight: 1.25, color: 'var(--color-text)' }}>
            {caption[0]}
            <span className="inline-block min-w-[3em] border-b-2 mx-1 align-baseline" style={{ borderColor: MUDDLE_ACCENT, color: '#5b21b6' }}>{es.final.answer.toLowerCase()}</span>
            {caption[1] ?? ''}
          </p>
          <div className="self-stretch" style={{ zoom: 0.8 }}>
            <div className={`${COLUMN_CLASS} mx-auto flex flex-col`}>
              {es.words.map((_, i) => (
                <WordRow key={i} state={es} row={i} active={false} shaking={false} finished onSelect={noop} onTapTile={noop} onRevealLetter={noop} onSolveWord={noop} />
              ))}
              <FinalRow state={es} active={false} shaking={false} finished onSelect={noop} onTapTile={noop} onRevealLetter={noop} />
            </div>
          </div>
        </>
      );
      break;
    }
  }
  return (
    <div ref={makeInert} className="mx-auto flex flex-col items-center gap-2 pt-1 pointer-events-none select-none" style={{ maxWidth: 320 }}>
      {body}
    </div>
  );
}

const formatTime = (s: number) => (s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`);

/**
 * "Completed today" for a More Games daily: the recorded daily_results line in
 * the header, and inside it the finished board rebuilt from the matches row,
 * the result and time, and the score breakdown scored from the row's exact
 * inputs. With no rebuildable row (signed out, row missing, bank mismatch) or
 * after LOAD_BOUND_MS it settles on the summary alone.
 */
export function CompletedMoreBoard({ dbKey }: { dbKey: string }) {
  const { profile } = useAuth();
  const { todayDailies } = useDailyCompletions();
  const recorded = todayDailies.get(dbKey) ?? null;
  const day = getTodayLocal();
  const userId = profile?.id ?? null;
  const id = recorded ? `${userId}|${day}|${dbKey}|${resultSig(recorded)}` : '';

  const [built, setBuilt] = useState<{ id: string; value: Built } | null>(null);
  const [timedOut, setTimedOut] = useState<string | null>(null);

  useEffect(() => {
    if (!recorded || !userId) return;
    let cancelled = false;
    const d: ElsewhereDaily = { seed: generateDailySeed(day, dbKey), won: recorded.won, guessCount: recorded.guesses };
    loadRow(userId, dbKey, day, id)
      .then((row) => (row ? buildMoreBoard(dbKey, row, d, day) : NOTHING))
      .catch(() => NOTHING)
      .then((value) => { if (!cancelled) setBuilt({ id, value }); });
    return () => { cancelled = true; };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bound the loading state whatever holds it up (auth, network, bank chunk).
  useEffect(() => {
    if (!id) return;
    const t = setTimeout(() => setTimedOut(id), LOAD_BOUND_MS);
    return () => clearTimeout(t);
  }, [id]);

  if (!recorded) return null;

  const current = built && built.id === id ? built.value : null;
  const pending = !current && timedOut !== id && !!userId;
  const meta = MODE_BY_DBKEY[dbKey];
  const won = recorded.won;
  const stat = formatGuessStat(meta?.guessSemantics ?? 'guesses', meta?.guessBase ?? 1, recorded.guesses);
  const total = current?.progress?.totalBoards ?? MODE_SCORE_CONFIG[dbKey]?.totalBoards ?? 1;
  const solved = current?.progress?.boardsSolved ?? (won ? total : 0);

  return (
    <CollapsibleCompletedCard won={won} summaryLabel={`${stat} · ${formatTime(recorded.timeSeconds)}`}>
      {current?.board ? (
        <FinishedMoreBoard board={current.board} won={won} />
      ) : pending ? (
        <div className="text-[10px] font-bold text-center py-2" style={{ color: 'var(--color-text-muted)' }}>Loading board…</div>
      ) : null}

      {/* Stats */}
      <div className="flex justify-center gap-5 mt-3">
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{stat}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Result</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>{formatTime(recorded.timeSeconds)}</div>
          <div className="text-[9px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Time</div>
        </div>
      </div>

      {/* Held while the row loads so a loss's partial credit doesn't jump. */}
      {!pending && (
        <ScoreBreakdownCard
          gameMode={dbKey}
          completed={won}
          guessCount={recorded.guesses}
          timeSeconds={recorded.timeSeconds}
          boardsSolved={solved}
          totalBoards={total}
          hintsUsed={current?.progress?.hintsUsed ?? 0}
          day={day}
        />
      )}
    </CollapsibleCompletedCard>
  );
}
