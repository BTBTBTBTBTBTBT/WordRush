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
import { Lock, X } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { UiIcon, medalIconName, type UiIconName } from '@/components/ui/ui-icon';
import { HeaderBack } from '@/components/ui/page-header';
import { evaluateGuess, highlightsLayout, sectionTitleColor } from '@wordle-duel/core';
import { BubbleText } from '@/components/ui/bubble-text';
import { modeLabel } from '@/lib/mode-labels';
import { getTodayLocal } from '@/lib/daily-service';
import { requiredSweepCount } from '@/lib/daily-modes';
import { getTileHex } from '@/lib/tile-theme';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { SoftNum } from '@/components/ui/soft-number';
import { MedalArt } from '@/components/stats/medal-art';
import { BrandEmptyState } from '@/components/ui/brand-empty-state';
import { CastLoader } from '@/components/ui/cast-loader';
import { PAGE_SCENES, type SceneName } from '@/lib/art';
import { BRAND_ACCENT, alphaHex, softBackground, softBorder, softCard, softPill } from '@/lib/soft-surface';
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
import { HeadingArt } from '@/components/ui/heading-art';
import { TrophyShelf } from './trophy-shelf';

// ── Shared bits ─────────────────────────────────────────────────────────────

/** The glossy 3D medal art for gold / silver / bronze (lib/art.ts medalSrc); the generic medal badge for anything else. */
function MedalGlyph({ medal, size = 20 }: { medal: string; size?: number }) {
  if (medal === 'gold' || medal === 'silver' || medal === 'bronze') return <MedalArt medal={medal} size={size} />;
  return <UiIcon name={medalIconName(medal)} size={size} />;
}
const MEDAL_TINT: Record<string, string> = { gold: '#f5a524', silver: '#94a3b8', bronze: '#d97706' };

export const archetypeName = (a: string): string => a.replace(/_/g, ' ');

/** Chip icon per archetype (matches the explainer modal): our 3D art, never an emoji (FINISH_SPEC AM3). */
export const ARCHETYPE_ICON: Record<Archetype, UiIconName> = {
  GRINDER: 'grid',
  SPEEDRUNNER: 'zap',
  SNIPER: 'target',
  NIGHT_OWL: 'sparkles',
  CHALLENGER: 'shield',
};

export function ArchetypeIcon({ archetype, size = 14 }: { archetype: Archetype; size?: number }) {
  return <UiIcon name={ARCHETYPE_ICON[archetype]} size={size} />;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function CardTitle({ children }: { children: ReactNode }) {
  // Item 17: section titles in the bubble lettering (TROPHY CASE, HIGHLIGHTS, LATELY, HEAD TO HEAD), tinted in
  // their cast color; composite titles ("YOU vs NAME") keep the quiet caps line.
  if (typeof children === 'string') {
    return (
      <div className="min-w-0" style={{ maxWidth: 240 }}>
        <BubbleText text={children.toUpperCase()} accent={sectionTitleColor(children)} align="left" maxSize={20} minSize={13} level={3} />
      </div>
    );
  }
  return (
    <div className="text-[10px] font-black uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>
      {children}
    </div>
  );
}

/** A tinted card (A1: its accent's wash, never plain white) with tap affordance: hover shadow, press squish (no chevron, ART_SPEC §21.4). */
function TappableCard({
  title,
  onClick,
  ariaLabel,
  children,
  gradient = false,
  accent = BRAND_ACCENT,
}: {
  title: ReactNode;
  onClick?: () => void;
  ariaLabel?: string;
  children: ReactNode;
  gradient?: boolean;
  accent?: string;
}) {
  const tappable = Boolean(onClick);
  return (
    <div
      role={tappable ? 'button' : undefined}
      tabIndex={tappable ? 0 : undefined}
      aria-label={ariaLabel}
      onClick={onClick}
      onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      // BJ7: 12 padding (was 16), 8 under the title.
      className={`relative rounded-2xl p-3 animate-fade-in-up ${tappable ? 'cursor-pointer transition-all active:scale-[0.98] hover:shadow-[0_3px_14px_rgba(124,58,237,0.10)]' : ''}`}
      style={{ ...softCard(accent, { radius: 18 }), ...(gradient ? { background: softBackground(accent, 0.18) } : null) }}
    >
      <div className="flex items-center justify-between mb-2">
        <CardTitle>{title}</CardTitle>
      </div>
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
        style={{ background: softBackground(BRAND_ACCENT, 0.08), border: softBorder(BRAND_ACCENT, 0.08), borderRadius: '20px', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
        <HeaderBack kind="close" onClick={onClose} size={30} className="float-right -mt-1 -mr-1" />
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

/** BI24: a modal's empty / error state, compact: the cast scene, gradient caps title, one line. No box. */
function EmptyNote({ title, line, scene = PAGE_SCENES.empty }: { title: string; line: string; scene?: SceneName }) {
  return <BrandEmptyState scene={scene} artHeight={72} title={title} line={line} className="py-3" />;
}

/** A modal's loading state: the cast wave (never bare text). */
function LoadingNote({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex justify-center py-6"><CastLoader size={18} /></div>
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
      {result === null && <LoadingNote label="Loading board" />}
      {result?.status === 'locked' && (
        <BrandEmptyState
          host="w"
          artHeight={80}
          className="py-3"
          title="NO SPOILERS"
          line={`Finish today's ${modeLabel(mode)} first and this board opens up.`}
        />
      )}
      {result?.status === 'error' && <EmptyNote scene={PAGE_SCENES.offline} title="CAN'T LOAD THIS BOARD" line="Check your connection and try again later." />}
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
const ARCHETYPE_RULES: Array<{ key: Archetype; rule: string }> = [
  { key: 'GRINDER', rule: 'Swept every daily on 3 or more days. Checked first — sweeping every mode daily is the rarest habit.' },
  { key: 'SPEEDRUNNER', rule: 'Average solve time 90 seconds or under (at least 10 timed games).' },
  { key: 'SNIPER', rule: 'Average 3.6 guesses or fewer on single-board modes (at least 10 games).' },
  { key: 'NIGHT_OWL', rule: '40%+ of plays late at night (measured in UTC, so it’s approximate by design).' },
  { key: 'CHALLENGER', rule: 'Everyone else — still building a signature style.' },
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
      <HeadingArt slug="archetypes" as="h3" label="Player archetypes" height={36} className="mb-3" />
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
                // BJ7: no outlined boxes — the target reads by its deeper wash.
                background: isTheirs ? alphaHex('#7c3aed', 0.22) : alphaHex('#7c3aed', 0.07),
              }}
            >
              <div className="flex items-center gap-2">
                <ArchetypeIcon archetype={a.key} size={18} />
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
          <SoftNum size={24} as="div" className="soft-num-auto">
            {h2h.youWin} – {h2h.theyWin}
          </SoftNum>
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
            style={{ ...softPill('#7c3aed', { radius: 12, bar: false }), color: 'var(--color-text)' }}
          >
            <span className="font-black uppercase" style={{ color: '#7c3aed' }}>{modeLabel(today.mode)}</span>
            <span>today — {targetName} {today.theirGuesses}, you {today.yourGuesses}</span>
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
        {/* BJ16: the HEAD TO HEAD lettering; who rides under it. */}
        <HeadingArt slug="h2h" as="h3" label={`You vs ${targetName}`} height={36} />
        <p aria-hidden="true" className="text-xs font-black text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>You vs {targetName}</p>
        {h2h.shared.length === 0 ? (
          <EmptyNote title="NO SHARED DAILIES YET" line="Play the same daily on the same day to compare." />
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
      <TappableCard title="TROPHY CASE" ariaLabel="Medal history" onClick={() => setShowHistory(true)} accent="#f5a524">
        <TrophyShelf gold={gold} silver={silver} bronze={bronze} />
        {flawless && flawless.count > 0 && (
          <div
            className="flex items-center gap-2 mt-2.5 rounded-xl px-3 py-2 text-[11.5px] font-bold"
            style={{ ...softPill('#7c3aed', { radius: 12, bar: false }), color: 'var(--color-text)' }}
          >
            <Icon3D name="trophy" size={18} />
            <span>Rarest: <b style={{ color: '#7c3aed' }}>Flawless Victory</b> ×{flawless.count}</span>
            <span className="ml-auto text-[10px] font-black whitespace-nowrap" style={{ color: '#ec4899' }}>
              held by {flawless.pctOfPlayers}% of players
            </span>
          </div>
        )}
      </TappableCard>

      <Modal open={showHistory} onClose={() => setShowHistory(false)} ariaLabel="Medal history" wide>
        <ModalTitle>{targetName}&apos;s medals</ModalTitle>
        {history === null && <LoadingNote label="Loading medals" />}
        {history !== null && history.length === 0 && <EmptyNote title="NO MEDALS YET" line="Medals land here once they're earned." />}
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
                <MedalGlyph medal={m.medal_type} size={20} />
                <div className="min-w-0">
                  <div className="text-xs font-black" style={{ color: 'var(--color-text)' }}>{modeLabel(m.game_mode)}</div>
                  <div className="text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{m.day}</div>
                </div>
                <div className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>
                  {m.composite_score}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={podiumFor !== null} onClose={() => setPodiumFor(null)} ariaLabel="Daily podium">
        {podiumFor && (
          <>
            <><HeadingArt slug="podium" as="h3" label={`${modeLabel(podiumFor.mode)} podium — ${podiumFor.day}`} height={36} />
            <p aria-hidden="true" className="text-xs font-black text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>{modeLabel(podiumFor.mode)} · {podiumFor.day}</p></>
            {podium === null && <LoadingNote label="Loading podium" />}
            {podium !== null && podium.length === 0 && <EmptyNote title="NO PODIUM" line="This day's podium isn't available." />}
            {podium !== null && podium.length > 0 && (
              <div className="space-y-1.5">
                {podium.map((p) => (
                  <Link
                    key={p.userId}
                    href={`/profile/${p.userId}`}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-transform active:scale-[0.98]"
                    style={softPill(MEDAL_TINT[p.medal] ?? BRAND_ACCENT, { radius: 12, bar: false })}
                  >
                    <MedalGlyph medal={p.medal} size={24} />
                    <span className="text-sm font-black truncate" style={{ color: 'var(--color-text)' }}>{p.username}</span>
                    <span className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{p.score}</span>
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
  icon: UiIconName;
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
      icon: 'flame',
      big: `${persona.longestWinStreak}-win streak`,
      cap: 'Career best',
      onClick: () => setShowCalendar(true),
    });
  }
  if (fastest) {
    items.push({
      key: 'fastest',
      icon: 'zap',
      big: formatClock(fastest.seconds),
      cap: `Fastest ${modeLabel(fastest.mode)} solve`,
    });
  }
  if (perfectOcto) {
    items.push({ key: 'octo', icon: 'grid', big: '8/8 boards', cap: `Perfect ${modeLabel('OCTORDLE')}` });
  }
  if (persona && persona.flawless.count >= 1) {
    items.push({
      key: 'flawless',
      icon: 'trophy',
      big: `${persona.flawless.count} Flawless`,
      cap: persona.flawless.count === 1 ? 'Day with every daily won' : 'Days with every daily won',
    });
  }

  if (items.length === 0) return null;
  // Item 17: never a lonely tile with an empty half — one highlight folds into a single centered line above Lately,
  // two or more fill an even 2-column grid (core highlightsLayout drops an odd last one).
  const layout = highlightsLayout(items.length);
  const shown = items.slice(0, layout.shown);

  return (
    <>
      {layout.mode === 'fold' ? (
        <div className="flex items-center justify-center gap-2 py-1 animate-fade-in-up" style={{ color: 'var(--color-text)' }}>
          <UiIcon name={shown[0].icon} size={20} />
          <span className="text-[14px] font-black">{shown[0].big}</span>
          <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{shown[0].cap}</span>
        </div>
      ) : (
      <div
        className="rounded-2xl p-3 animate-fade-in-up"
        style={softCard('#f97316', { radius: 18 })}
      >
        <div className="mb-2"><CardTitle>HIGHLIGHTS</CardTitle></div>
        <div className="grid grid-cols-2 gap-2.5">
          {shown.map((h) => {
            const tappable = Boolean(h.onClick);
            return (
              <div
                key={h.key}
                role={tappable ? 'button' : undefined}
                tabIndex={tappable ? 0 : undefined}
                onClick={h.onClick}
                onKeyDown={tappable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); h.onClick?.(); } } : undefined}
                className={`relative rounded-xl px-2.5 py-2 min-w-0 ${tappable ? 'cursor-pointer transition-transform active:scale-[0.97] hover:shadow-[0_3px_14px_rgba(124,58,237,0.10)]' : ''}`}
                style={softPill('#f97316', { radius: 12 })}
              >
                <div className="leading-none"><UiIcon name={h.icon} size={18} /></div>
                <div className="text-[15px] font-black mt-1 flex items-center gap-1" style={{ color: 'var(--color-text)' }}>
                  {h.big}
                </div>
                <div className="text-[9.5px] font-bold mt-0.5 leading-snug" style={{ color: 'var(--color-text-muted)' }}>{h.cap}</div>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <Modal open={showCalendar} onClose={() => setShowCalendar(false)} ariaLabel="Streak calendar">
        {/* BJ16: the STREAK CALENDAR lettering; the window rides under it. */}
        <HeadingArt slug="streakcal" as="h3" label="Streak calendar, last 60 days" height={36} />
        <p aria-hidden="true" className="text-xs font-black text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>Last 60 days</p>
        {calendar === null && <LoadingNote label="Loading calendar" />}
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
                    boxShadow: d.completedCount >= requiredSweepCount(d.day) ? '0 0 0 2px #f59e0b' : undefined,
                  }}
                />
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 mt-3 text-[10px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7c3aed' }} /> played</span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#7c3aed', boxShadow: '0 0 0 2px #f59e0b' }} /> full-sweep day</span>
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
        className="rounded-2xl p-3 animate-fade-in-up"
        style={softCard('#0d9488', { radius: 18 })}
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
              className={`flex items-start gap-2.5 py-1.5 ${tappable ? 'cursor-pointer rounded-lg -mx-1 px-1 active:scale-[0.99] transition-transform' : ''}`}
              style={{ borderTop: i > 0 ? '1px solid var(--color-border)' : undefined }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                style={{ background: alphaHex('#0d9488', 0.14) }}
              >
                <UiIcon name={e.icon} size={18} />
              </div>
              <div className="text-xs font-bold leading-snug" style={{ color: 'var(--color-text)' }}>
                {e.text}
                <span className="block text-[10px] font-extrabold mt-1" style={{ color: 'var(--color-text-muted)' }}>{e.when}</span>
              </div>
            </div>
          );
        })}
        {events !== null && events.length === 0 && nemesis && (
          <p className="text-xs font-bold py-1" style={{ color: 'var(--color-text-muted)' }}>Quiet lately.</p>
        )}
        {nemesis && (
          <Link
            href={`/profile/${nemesis.userId}`}
            className="flex items-center gap-2 mt-1.5 rounded-xl px-3 py-2 text-[11.5px] font-bold transition-transform active:scale-[0.98]"
            style={{ background: 'rgba(236,72,153,0.12)', color: 'var(--color-text)' }}
          >
            <UiIcon name="swords" size={16} />
            <span>Most frequent rival: <b style={{ color: '#ec4899' }}>{nemesis.username}</b> — {nemesis.sharedBoards} shared boards</span>
          </Link>
        )}
      </div>

      <Modal open={podiumFor !== null} onClose={() => setPodiumFor(null)} ariaLabel="Daily podium">
        {podiumFor && (
          <>
            <><HeadingArt slug="podium" as="h3" label={`${modeLabel(podiumFor.mode)} podium — ${podiumFor.day}`} height={36} />
            <p aria-hidden="true" className="text-xs font-black text-center mb-3" style={{ color: 'var(--color-text-muted)' }}>{modeLabel(podiumFor.mode)} · {podiumFor.day}</p></>
            {podium === null && <LoadingNote label="Loading podium" />}
            {podium !== null && podium.length === 0 && <EmptyNote title="NO PODIUM" line="This day's podium isn't available." />}
            {podium !== null && podium.length > 0 && (
              <div className="space-y-1.5">
                {podium.map((p) => (
                  <Link
                    key={p.userId}
                    href={`/profile/${p.userId}`}
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-transform active:scale-[0.98]"
                    style={softPill(MEDAL_TINT[p.medal] ?? BRAND_ACCENT, { radius: 12, bar: false })}
                  >
                    <MedalGlyph medal={p.medal} size={24} />
                    <span className="text-sm font-black truncate" style={{ color: 'var(--color-text)' }}>{p.username}</span>
                    <span className="ml-auto text-xs font-black tabular-nums" style={{ color: 'var(--color-text-muted)' }}>{p.score}</span>
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
