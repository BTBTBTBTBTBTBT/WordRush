'use client';

/**
 * "Profile social" cards for the public profile — You-vs-Them, Trophy Case,
 * Highlights reel, Lately feed — plus their drill-down modals (H2H detail,
 * medal history, podium, streak calendar, archetype explainer, and the
 * spoiler-guarded board viewer).
 *
 * Every card fetches its own data non-blocking and renders nothing (or a
 * partial card) until it arrives, so the existing profile content is never
 * held up. Mode names always go through modeLabel() — raw enum keys like
 * DUEL_6 must never reach the screen.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Lock, X } from 'lucide-react';
import { evaluateGuess } from '@wordle-duel/core';
import { modeLabel } from '@/lib/mode-labels';
import { getTodayLocal } from '@/lib/daily-service';
import { getTileHex } from '@/lib/tile-theme';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import {
  fetchH2H,
  fetchTodayCompare,
  fetchMedalHistory,
  fetchPodium,
  fetchStreakCalendar,
  fetchLately,
  fetchPerfectOcto,
  fetchPersona,
  fetchGuardedBoard,
  type Archetype,
  type Persona,
  type H2HSummary,
  type TodayCompare,
  type MedalRow,
  type PodiumRow,
  type CalendarDay,
  type LatelyEvent,
  type BoardFetchResult,
} from '@/lib/profile-social';

// ── Shared bits ─────────────────────────────────────────────────────────────

const MEDAL_EMOJI: Record<string, string> = { gold: '\u{1F947}', silver: '\u{1F948}', bronze: '\u{1F949}' };

export const archetypeName = (a: string): string => a.replace(/_/g, ' ');

/** Chip emoji per archetype (matches the explainer modal). */
export const ARCHETYPE_EMOJI: Record<Archetype, string> = {
  GRINDER: '\u{1F9F1}',
  SPEEDRUNNER: '⚡',
  SNIPER: '\u{1F3AF}',
  NIGHT_OWL: '\u{1F989}',
  CHALLENGER: '\u{1F6E1}️',
};

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CardTitle({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </div>
  );
}

/** The mock's white card with tap affordance: chevron, hover shadow, press scale. */
function TappableCard({
  title,
  onClick,
  ariaLabel,
  children,
  gradient = false,
}: {
  title: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  gradient?: boolean;
}) {
  const tappable = Boolean(onClick);
  return (
    <div
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={`relative rounded-2xl p-4 animate-fade-in-up ${tappable ? 'cursor-pointer transition-all active:scale-[0.98] hover:shadow-[0_3px_14px_rgba(124,58,237,0.10)]' : ''}`}
      style={{
        background: gradient
          ? 'linear-gradient(135deg, var(--color-surface-hover), var(--color-surface))'
          : 'var(--color-surface)',
        border: '1.5px solid var(--color-border)',
      }}
    >
      <div className="flex items-center justify-between mb-2.5 pr-5">
        <CardTitle>{title}</CardTitle>
      </div>
      {tappable && (
        <ChevronRight className="absolute right-3 top-4 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
      )}
      {children}
    </div>
  );
}

/** Modal shell matching the app's existing overlay idiom (mode-limit-modal). */
function Modal({
  open,
  onClose,
  ariaLabel,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  ariaLabel: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const focusRef = useRef<HTMLDivElement>(null);
  useFocusTrap(focusRef, open);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-modal-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        ref={focusRef}
        className={`w-full ${wide ? 'max-w-md' : 'max-w-sm'} max-h-[85vh] overflow-y-auto p-5 animate-modal-content`}
        style={{ background: 'var(--color-surface)', borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="float-right -mt-1 -mr-1 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text-muted)' }}
        >
          <X className="w-4 h-4" />
        </button>
        {children}
      </div>
    </div>
  );
}

function ModalTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-base font-black mb-3" style={{ color: 'var(--color-text)' }}>{children}</h3>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-bold text-center py-6" style={{ color: 'var(--color-text-muted)' }}>{children}</p>
  );
}

// ── Guarded board modal ─────────────────────────────────────────────────────

/** Shared-guess multi-board modes; everything else consumes guesses in order. */
const SHARED_GUESS_MODES = new Set(['QUORDLE', 'OCTORDLE']);
const isWordGuess = (g: string) => /^[A-Za-z]+$/.test(g);

function safeRows(solution: string, guesses: string[]): Array<{ letters: string[]; states: string[] }> {
  const rows: Array<{ letters: string[]; states: string[] }> = [];
  for (const g of guesses) {
    if (g.length !== solution.length) continue;
    try {
      const states = evaluateGuess(solution.toUpperCase(), g.toUpperCase()).tiles.map((t: any) => String(t.state));
      rows.push({ letters: g.toUpperCase().split(''), states });
    } catch {
      continue;
    }
    if (g.toUpperCase() === solution.toUpperCase()) break;
  }
  return rows;
}

function BoardTiles({ solution, guesses }: { solution: string; guesses: string[] }) {
  const rows = safeRows(solution, guesses);
  return (
    <div className="inline-flex flex-col gap-1">
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-1">
          {row.letters.map((ch, ci) => {
            const hex = getTileHex(row.states[ci]);
            return (
              <div
                key={ci}
                className="w-7 h-7 rounded flex items-center justify-center text-[13px] font-black"
                style={{ background: hex.bg, border: `1.5px solid ${hex.border}`, color: hex.text }}
              >
                {ch}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function GuardedBoardModal({
  open,
  onClose,
  targetId,
  targetName,
  day,
  mode,
}: {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetName: string;
  day: string;
  mode: string;
}) {
  const [result, setResult] = useState<BoardFetchResult | null>(null);

  useEffect(() => {
    if (!open) { setResult(null); return; }
    let active = true;
    fetchGuardedBoard(targetId, `daily-${day}-${mode}`).then((r) => { if (active) setResult(r); });
    return () => { active = false; };
  }, [open, targetId, day, mode]);

  const board = result?.status === 'ok' ? result.board : null;
  const wordGuesses = board ? board.guesses.map(String).filter(isWordGuess) : [];

  // Sequential modes (Succession, Gauntlet…): split guesses per board as each
  // solution is reached. Shared-guess modes (QuadWord, OctoWord): every board
  // sees the full guess list.
  const perBoardGuesses: string[][] = [];
  if (board) {
    if (board.solutions.length <= 1 || SHARED_GUESS_MODES.has(board.gameMode)) {
      for (let i = 0; i < board.solutions.length; i++) perBoardGuesses.push(wordGuesses);
    } else {
      let rest = [...wordGuesses];
      for (const sol of board.solutions) {
        const hit = rest.findIndex((g) => g.toUpperCase() === sol.toUpperCase());
        if (hit >= 0) {
          perBoardGuesses.push(rest.slice(0, hit + 1));
          rest = rest.slice(hit + 1);
        } else {
          perBoardGuesses.push(rest);
          rest = [];
        }
      }
    }
  }

  return (
    <Modal open={open} onClose={onClose} ariaLabel={`${targetName}'s ${modeLabel(mode)} board`} wide>
      <ModalTitle>{targetName}&apos;s {modeLabel(mode)} — {day}</ModalTitle>
      {result === null && <EmptyNote>Loading board…</EmptyNote>}
      {result?.status === 'locked' && (
        <div className="text-center py-6">
          <Lock className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
          <p className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
            Finish today&apos;s {modeLabel(mode)} first — no spoilers
          </p>
          <p className="text-xs font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Boards open only for dailies you&apos;ve finished.
          </p>
        </div>
      )}
      {result?.status === 'error' && <EmptyNote>Couldn&apos;t load this board. Try again later.</EmptyNote>}
      {board && (
        <div>
          <div className="flex items-center gap-3 mb-3 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span style={{ color: board.won ? '#7c3aed' : '#dc2626' }}>{board.won ? 'Won' : 'Lost'}</span>
            {board.timeSeconds > 0 && <span>{formatClock(board.timeSeconds)}</span>}
            {board.hintsUsed > 0 && <span>{board.hintsUsed} hint{board.hintsUsed === 1 ? '' : 's'}</span>}
          </div>
          <div className="flex flex-wrap gap-4 justify-center">
            {board.solutions.map((sol, i) => (
              <BoardTiles key={i} solution={String(sol)} guesses={perBoardGuesses[i] ?? []} />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Archetype explainer modal ───────────────────────────────────────────────

/** Rules mirror the persona route exactly — that route is the single source. */
const ARCHETYPE_RULES: Array<{ key: Archetype; emoji: string; rule: string }> = [
  { key: 'GRINDER', emoji: '\u{1F9F1}', rule: 'Swept all 9 dailies on 3 or more days. Checked first — sweeping every mode daily is the rarest habit.' },
  { key: 'SPEEDRUNNER', emoji: '⚡', rule: 'Average solve time 90 seconds or under (at least 10 timed games).' },
  { key: 'SNIPER', emoji: '\u{1F3AF}', rule: 'Average 3.6 guesses or fewer on single-board modes (at least 10 games).' },
  { key: 'NIGHT_OWL', emoji: '\u{1F989}', rule: '40%+ of plays late at night (measured in UTC, so it’s approximate by design).' },
  { key: 'CHALLENGER', emoji: '\u{1F6E1}️', rule: 'Everyone else — still building a signature style.' },
];

export function ArchetypeModal({
  open,
  onClose,
  targetName,
  targetArchetype,
  viewerId,
}: {
  open: boolean;
  onClose: () => void;
  targetName: string;
  targetArchetype: Archetype;
  viewerId: string | null;
}) {
  const [mine, setMine] = useState<Archetype | null>(null);

  useEffect(() => {
    if (!open || !viewerId) return;
    let active = true;
    fetchPersona(viewerId).then((p) => { if (active && p) setMine(p.archetype); });
    return () => { active = false; };
  }, [open, viewerId]);

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Player archetypes explained">
      <ModalTitle>Player archetypes</ModalTitle>
      <p className="text-xs font-bold mb-3" style={{ color: 'var(--color-text-muted)' }}>
        Computed from recent solo dailies. First matching rule wins, top to bottom.
      </p>
      <div className="space-y-2">
        {ARCHETYPE_RULES.map((a) => {
          const isTheirs = a.key === targetArchetype;
          return (
            <div
              key={a.key}
              className="rounded-xl p-2.5"
              style={{
                background: isTheirs ? 'var(--color-surface-hover)' : 'transparent',
                border: isTheirs ? '1.5px solid #c4b5fd' : '1.5px solid var(--color-border)',
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">{a.emoji}</span>
                <span className="text-xs font-black tracking-wide" style={{ color: isTheirs ? '#7c3aed' : 'var(--color-text)' }}>
                  {archetypeName(a.key)}
                </span>
                {isTheirs && (
                  <span className="text-[9px] font-black uppercase tracking-wider ml-auto" style={{ color: '#7c3aed' }}>
                    {targetName}
                  </span>
                )}
                {mine === a.key && !isTheirs && (
                  <span className="text-[9px] font-black uppercase tracking-wider ml-auto" style={{ color: '#ec4899' }}>
                    You
                  </span>
                )}
                {mine === a.key && isTheirs && (
                  <span className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#ec4899' }}>
                    + You
                  </span>
                )}
              </div>
              <p className="text-[11px] font-bold mt-1" style={{ color: 'var(--color-text-muted)' }}>{a.rule}</p>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

// ── You vs Them ─────────────────────────────────────────────────────────────

export function YouVsThemCard({
  viewerId,
  targetId,
  targetName,
}: {
  viewerId: string;
  targetId: string;
  targetName: string;
}) {
  const [h2h, setH2h] = useState<H2HSummary | null>(null);
  const [today, setToday] = useState<TodayCompare | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showBoard, setShowBoard] = useState(false);

  useEffect(() => {
    let active = true;
    fetchH2H(viewerId, targetId).then((r) => { if (active) setH2h(r); });
    fetchTodayCompare(viewerId, targetId).then((r) => { if (active) setToday(r); });
    return () => { active = false; };
  }, [viewerId, targetId]);

  if (!h2h || h2h.shared.length === 0) return null;

  const leadNote = h2h.monthYou > h2h.monthThey
    ? 'You lead this month'
    : h2h.monthThey > h2h.monthYou
      ? 'They lead this month'
      : 'Even this month';

  return (
    <>
      <TappableCard
        title={<>YOU vs {targetName.toUpperCase()}</>}
        ariaLabel={`Head-to-head with ${targetName}`}
        onClick={() => setShowDetail(true)}
        gradient
      >
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-2xl font-black tabular-nums" style={{ color: 'var(--color-text)' }}>
            <span style={{ color: '#7c3aed' }}>{h2h.youWin}</span> – {h2h.theyWin}
          </div>
          <div className="text-[10.5px] font-bold text-right leading-snug" style={{ color: 'var(--color-text-muted)' }}>
            {leadNote}<br />{h2h.shared.length} shared dail{h2h.shared.length === 1 ? 'y' : 'ies'} all-time
          </div>
        </div>

        {today && (
          <div
            role="button"
            tabIndex={0}
            aria-label={`View ${targetName}'s ${modeLabel(today.mode)} board from today`}
            onClick={(e) => { e.stopPropagation(); setShowBoard(true); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); setShowBoard(true); } }}
            className="flex items-center gap-2 rounded-xl px-2.5 py-2 text-[11.5px] font-bold cursor-pointer transition-transform active:scale-[0.98]"
            style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            <span className="font-black uppercase" style={{ color: '#7c3aed' }}>{modeLabel(today.mode)}</span>
            <span>today — {targetName} {today.theirGuesses}, you {today.yourGuesses}</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          </div>
        )}
        <div className="flex items-center gap-1 mt-1.5 text-[9px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>
          <Lock className="w-2.5 h-2.5 shrink-0" /> Boards open only for dailies you&apos;ve finished
        </div>

        <div className="flex gap-2.5 mt-2.5">
          {[
            {
              label: 'AVG GUESSES',
              them: h2h.avgGuessThem !== null ? String(h2h.avgGuessThem) : '–',
              you: h2h.avgGuessYou !== null ? String(h2h.avgGuessYou) : '–',
            },
            {
              label: 'AVG SOLVE',
              them: h2h.avgTimeThem !== null ? formatClock(h2h.avgTimeThem) : '–',
              you: h2h.avgTimeYou !== null ? formatClock(h2h.avgTimeYou) : '–',
            },
            { label: 'SWEEPS', them: String(h2h.sweepsThem), you: String(h2h.sweepsYou) },
          ].map((s) => (
            <div key={s.label} className="flex-1 text-center">
              <div className="text-[9px] font-black tracking-wider mb-0.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
              <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>
                <span style={{ color: '#ec4899' }}>{s.them}</span> / <span style={{ color: 'var(--color-text-muted)' }}>{s.you}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="text-[8.5px] font-extrabold text-center mt-1" style={{ color: 'var(--color-text-muted)' }}>
          <span style={{ color: '#ec4899' }}>{targetName}</span> / you · shared dailies
        </div>
      </TappableCard>

      <Modal open={showDetail} onClose={() => setShowDetail(false)} ariaLabel="All shared dailies" wide>
        <ModalTitle>You vs {targetName}</ModalTitle>
        {h2h.shared.length === 0 ? (
          <EmptyNote>No shared dailies yet.</EmptyNote>
        ) : (
          <div className="space-y-1">
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 text-[9px] font-black uppercase tracking-wider pb-1" style={{ color: 'var(--color-text-muted)' }}>
              <span>Daily</span><span className="text-right w-14">{targetName.slice(0, 8)}</span><span className="text-right w-14">You</span>
            </div>
            {h2h.shared.map((s) => {
              const theyWon = s.theirScore > s.yourScore;
              const youWon = s.yourScore > s.theirScore;
              return (
                <div
                  key={`${s.day}-${s.mode}`}
                  className="grid grid-cols-[1fr_auto_auto] gap-x-3 items-center py-1.5 text-xs font-bold"
                  style={{ borderTop: '1px solid var(--color-border)' }}
                >
                  <div style={{ color: 'var(--color-text)' }}>
                    <span className="font-black">{modeLabel(s.mode)}</span>
                    <span className="ml-1.5 text-[10px]" style={{ color: 'var(--color-text-muted)' }}>{s.day}</span>
                  </div>
                  <div className="text-right w-14 tabular-nums flex items-center justify-end gap-1" style={{ color: theyWon ? '#ec4899' : 'var(--color-text-muted)' }}>
                    {theyWon && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#ec4899' }} />}
                    {s.theirScore}
                  </div>
                  <div className="text-right w-14 tabular-nums flex items-center justify-end gap-1" style={{ color: youWon ? '#7c3aed' : 'var(--color-text-muted)' }}>
                    {youWon && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: '#7c3aed' }} />}
                    {s.yourScore}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Modal>

      {today && (
        <GuardedBoardModal
          open={showBoard}
          onClose={() => setShowBoard(false)}
          targetId={targetId}
          targetName={targetName}
          day={getTodayLocal()}
          mode={today.mode}
        />
      )}
    </>
  );
}

// ── Trophy case ─────────────────────────────────────────────────────────────

export function TrophyCaseCard({
  targetId,
  targetName,
  gold,
  silver,
  bronze,
  persona,
}: {
  targetId: string;
  targetName: string;
  gold: number;
  silver: number;
  bronze: number;
  persona: Persona | null;
}) {
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<MedalRow[] | null>(null);
  const [podiumFor, setPodiumFor] = useState<{ day: string; mode: string } | null>(null);
  const [podium, setPodium] = useState<PodiumRow[] | null>(null);

  useEffect(() => {
    if (!showHistory || history !== null) return;
    let active = true;
    fetchMedalHistory(targetId).then((r) => { if (active) setHistory(r); });
    return () => { active = false; };
  }, [showHistory, history, targetId]);

  useEffect(() => {
    if (!podiumFor) { setPodium(null); return; }
    let active = true;
    fetchPodium(podiumFor.day, podiumFor.mode).then((r) => { if (active) setPodium(r); });
    return () => { active = false; };
  }, [podiumFor]);

  const flawless = persona?.flawless ?? null;

  return (
    <>
      <TappableCard title="TROPHY CASE" ariaLabel="Medal history" onClick={() => setShowHistory(true)}>
        <div className="flex gap-2.5">
          {[
            { medal: 'gold', count: gold, cap: 'GOLD', highlight: true },
            { medal: 'silver', count: silver, cap: 'SILVER', highlight: false },
            { medal: 'bronze', count: bronze, cap: 'BRONZE', highlight: false },
          ].map((t) => (
            <div
              key={t.medal}
              className="flex-1 text-center rounded-xl py-2.5"
              style={{
                background: t.highlight && t.count > 0 ? 'var(--color-highlight-gold)' : 'var(--color-surface)',
                border: t.highlight && t.count > 0 ? '1.5px solid var(--color-gold-border)' : '1.5px solid var(--color-border)',
              }}
            >
              <div className="text-base leading-none">{MEDAL_EMOJI[t.medal]}</div>
              <div className="text-xl font-black tabular-nums" style={{ color: 'var(--color-text)' }}>{t.count}</div>
              <div className="text-[9px] font-black tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{t.cap}</div>
            </div>
          ))}
        </div>
        {flawless && flawless.count > 0 && (
          <div
            className="flex items-center gap-2 mt-2.5 rounded-xl px-3 py-2 text-[11.5px] font-bold"
            style={{ background: 'var(--color-surface-hover)', color: 'var(--color-text)' }}
          >
            <span>{'\u{1F48E}'}</span>
            <span>Rarest: <b style={{ color: '#7c3aed' }}>Flawless Victory</b> ×{flawless.count}</span>
            <span className="ml-auto text-[10px] font-black whitespace-nowrap" style={{ color: '#ec4899' }}>
              held by {flawless.pctOfPlayers}% of players
            </span>
          </div>
        )}
      </TappableCard>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} ariaLabel="Medal history" wide>
        <ModalTitle>{targetName}&apos;s medals</ModalTitle>
        {history === null && <EmptyNote>Loading…</EmptyNote>}
        {history !== null && history.length === 0 && <EmptyNote>No medals yet.</EmptyNote>}
        {history !== null && history.length > 0 && (
          <div>
            {history.map((m, i) => (
              <div
                key={`${m.day}-${m.game_mode}-${i}`}
                role="button"
                tabIndex={0}
                aria-label={`Podium for ${modeLabel(m.game_mode)} on ${m.day}`}
                onClick={() => setPodiumFor({ day: m.day, mode: m.game_mode })}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPodiumFor({ day: m.day, mode: m.game_mode }); } }}
                className="flex items-center gap-2.5 py-2 px-1 -mx-1 rounded-lg cursor-pointer transition-colors active:scale-[0.99]"
                style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}
              >
                <span className="text-base">{MEDAL_EMOJI[m.medal_type] ?? '\u{1F3C5}'}</span>
                <div className="min-w-0">
                  <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>{modeLabel(m.game_mode)}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{m.day}</div>
                </div>
                <div className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {m.composite_score}
                </div>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={podiumFor !== null} onClose={() => setPodiumFor(null)} ariaLabel="Daily podium">
        {podiumFor && (
          <>
            <ModalTitle>{modeLabel(podiumFor.mode)} podium — {podiumFor.day}</ModalTitle>
            {podium === null && <EmptyNote>Loading…</EmptyNote>}
            {podium !== null && podium.length === 0 && <EmptyNote>Podium unavailable for this day.</EmptyNote>}
            {podium !== null && podium.length > 0 && (
              <div className="space-y-1.5">
                {podium.map((p) => (
                  <Link
                    key={p.userId}
                    href={`/profile/${p.userId}`}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-transform active:scale-[0.98]"
                    style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }}
                  >
                    <span className="text-lg">{MEDAL_EMOJI[p.medal] ?? '\u{1F3C5}'}</span>
                    <span className="text-sm font-black truncate" style={{ color: 'var(--color-text)' }}>{p.username}</span>
                    <span className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{p.score}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}

// ── Highlights reel ─────────────────────────────────────────────────────────

interface HighlightItem {
  key: string;
  emoji: string;
  big: string;
  cap: string;
  onClick?: () => void;
}

export function HighlightsReel({
  targetId,
  persona,
  fastest,
}: {
  targetId: string;
  persona: Persona | null;
  /** Best (mode, fastest_time) across the target's solo user_stats, or null. */
  fastest: { mode: string; seconds: number } | null;
}) {
  const [perfectOcto, setPerfectOcto] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendar, setCalendar] = useState<CalendarDay[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchPerfectOcto(targetId).then((r) => { if (active) setPerfectOcto(r); });
    return () => { active = false; };
  }, [targetId]);

  useEffect(() => {
    if (!showCalendar || calendar !== null) return;
    let active = true;
    fetchStreakCalendar(targetId).then((r) => { if (active) setCalendar(r); });
    return () => { active = false; };
  }, [showCalendar, calendar, targetId]);

  const items: HighlightItem[] = [];
  if (persona && persona.longestWinStreak >= 2) {
    items.push({
      key: 'streak',
      emoji: '\u{1F3C6}',
      big: `${persona.longestWinStreak}-win streak`,
      cap: 'Career best',
      onClick: () => setShowCalendar(true),
    });
  }
  if (fastest) {
    items.push({
      key: 'fastest',
      emoji: '⚡',
      big: formatClock(fastest.seconds),
      cap: `Fastest ${modeLabel(fastest.mode)} solve`,
    });
  }
  if (perfectOcto) {
    items.push({ key: 'octo', emoji: '\u{1F4A5}', big: '8/8 boards', cap: `Perfect ${modeLabel('OCTORDLE')}` });
  }
  if (persona && persona.flawless.count >= 1) {
    items.push({
      key: 'flawless',
      emoji: '\u{1F48E}',
      big: `${persona.flawless.count} Flawless`,
      cap: persona.flawless.count === 1 ? 'Day with all 9 dailies won' : 'Days with all 9 dailies won',
    });
  }

  if (items.length === 0) return null;

  return (
    <>
      <div
        className="rounded-2xl p-4 animate-fade-in-up"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <div className="mb-2.5"><CardTitle>HIGHLIGHTS</CardTitle></div>
        <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {items.map((h) => {
            const tappable = Boolean(h.onClick);
            return (
              <div
                key={h.key}
                role={tappable ? 'button' : undefined}
                tabIndex={tappable ? 0 : undefined}
                onClick={h.onClick}
                onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.onClick?.(); } } : undefined}
                className={`relative min-w-[122px] rounded-xl px-3 py-2.5 shrink-0 ${tappable ? 'cursor-pointer transition-transform active:scale-[0.97] hover:shadow-[0_3px_14px_rgba(124,58,237,0.10)]' : ''}`}
                style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
              >
                <div className="text-base leading-none">{h.emoji}</div>
                <div className="text-[15px] font-black mt-1 flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                  {h.big}
                  {tappable && <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-text-muted)' }} />}
                </div>
                <div className="text-[9.5px] font-bold mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{h.cap}</div>
              </div>
            );
          })}
        </div>
      </div>

      <Modal open={showCalendar} onClose={() => setShowCalendar(false)} ariaLabel="Streak calendar">
        <ModalTitle>Last 60 days</ModalTitle>
        {calendar === null && <EmptyNote>Loading…</EmptyNote>}
        {calendar !== null && (
          <>
            <div className="grid grid-cols-10 gap-1.5 justify-items-center">
              {calendar.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} — ${d.played ? `${d.completedCount} completed` : 'not played'}`}
                  className="w-4 h-4 rounded-full"
                  style={{
                    background: d.played ? '#7c3aed' : 'var(--color-border)',
                    boxShadow: d.completedCount >= 9 ? '0 0 0 2px #f59e0b' : undefined,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7c3aed' }} /> played</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7c3aed', boxShadow: '0 0 0 2px #f59e0b' }} /> 9/9 day</span>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}

// ── Lately feed + nemesis ───────────────────────────────────────────────────

export function LatelyCard({
  targetId,
  persona,
}: {
  targetId: string;
  persona: Persona | null;
}) {
  const [events, setEvents] = useState<LatelyEvent[] | null>(null);
  const [podiumFor, setPodiumFor] = useState<{ day: string; mode: string } | null>(null);
  const [podium, setPodium] = useState<PodiumRow[] | null>(null);

  useEffect(() => {
    let active = true;
    fetchLately(targetId).then((r) => { if (active) setEvents(r); });
    return () => { active = false; };
  }, [targetId]);

  useEffect(() => {
    if (!podiumFor) { setPodium(null); return; }
    let active = true;
    fetchPodium(podiumFor.day, podiumFor.mode).then((r) => { if (active) setPodium(r); });
    return () => { active = false; };
  }, [podiumFor]);

  const nemesis = persona?.nemesis ?? null;
  if ((events === null || events.length === 0) && !nemesis) return null;

  return (
    <>
      <div
        className="rounded-2xl p-4 animate-fade-in-up"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
      >
        <div className="mb-1.5"><CardTitle>LATELY</CardTitle></div>
        {(events ?? []).map((e, i) => {
          const tappable = Boolean(e.podium);
          return (
            <div
              key={e.id}
              role={tappable ? 'button' : undefined}
              tabIndex={tappable ? 0 : undefined}
              onClick={tappable ? () => setPodiumFor(e.podium!) : undefined}
              onKeyDown={tappable ? (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); setPodiumFor(e.podium!); } } : undefined}
              className={`flex items-start gap-2.5 py-2 ${tappable ? 'cursor-pointer rounded-lg -mx-1 px-1 active:scale-[0.99] transition-transform' : ''}`}
              style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: 'var(--color-surface-hover)' }}
              >
                {e.emoji}
              </div>
              <div className="text-xs font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                {e.text}
                <span className="block text-[10px] font-extrabold" style={{ color: 'var(--color-text-muted)' }}>{e.when}</span>
              </div>
              {tappable && <ChevronRight className="w-3.5 h-3.5 ml-auto self-center shrink-0" style={{ color: 'var(--color-text-muted)' }} />}
            </div>
          );
        })}
        {events !== null && events.length === 0 && nemesis && (
          <p className="text-xs font-bold py-1" style={{ color: 'var(--color-text-muted)' }}>Quiet lately.</p>
        )}
        {nemesis && (
          <Link
            href={`/profile/${nemesis.userId}`}
            className="flex items-center gap-2 mt-2 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(236,72,153,0.06)', border: '1.5px solid #f9a8d4', color: 'var(--color-text)' }}
          >
            <span>{'⚔️'}</span>
            <span>Most frequent rival: <b style={{ color: '#ec4899' }}>{nemesis.username}</b> — {nemesis.sharedBoards} shared boards</span>
            <ChevronRight className="w-3.5 h-3.5 ml-auto shrink-0" style={{ color: 'var(--color-text-muted)' }} />
          </Link>
        )}
      </div>

      <Modal open={podiumFor !== null} onClose={() => setPodiumFor(null)} ariaLabel="Daily podium">
        {podiumFor && (
          <>
            <ModalTitle>{modeLabel(podiumFor.mode)} podium — {podiumFor.day}</ModalTitle>
            {podium === null && <EmptyNote>Loading…</EmptyNote>}
            {podium !== null && podium.length === 0 && <EmptyNote>Podium unavailable for this day.</EmptyNote>}
            {podium !== null && podium.length > 0 && (
              <div className="space-y-1.5">
                {podium.map((p) => (
                  <Link
                    key={p.userId}
                    href={`/profile/${p.userId}`}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-transform active:scale-[0.98]"
                    style={{ background: 'var(--color-surface-hover)', border: '1.5px solid var(--color-border)' }}
                  >
                    <span className="text-lg">{MEDAL_EMOJI[p.medal] ?? '\u{1F3C5}'}</span>
                    <span className="text-sm font-black truncate" style={{ color: 'var(--color-text)' }}>{p.username}</span>
                    <span className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{p.score}</span>
                    <ChevronRight className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-text-muted)' }} />
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </Modal>
    </>
  );
}
