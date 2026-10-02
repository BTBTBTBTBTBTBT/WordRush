'use client';

import { Swords, X } from 'lucide-react';
import { HeaderBack } from '@/components/ui/page-header';
import { Icon3D } from '@/components/ui/icon3d';
import { challengeHeadline, vsClock, vsMargin, type VsRun } from '@wordle-duel/core';
import { challengeSentSub, h2hLine, modeColor, modeTitle, rowStates } from '@/lib/vs-lobby';
import type { HeadToHeadRecord } from '@/lib/head-to-head';
import { InitialAvatar, VsModeIcon } from './vs-ui';
import { ResultHost } from '@/components/ui/mascot';
import { vsResultHost } from '@/lib/mascots';
import { MomentArt } from '@/components/ui/art-title';
import { resultMoment } from '@/lib/art';

// The async challenge screens in the HOME palette (VS overhaul §3 + §5, canvas
// board AA phone 4): the race result (YOU vs @DOUG over one split window, the
// margin, both mini boards, head-to-head + XP, CHALLENGE BACK) and the
// CHALLENGE SENT screen after a challenge-send game.

const SINGLE_BOARD = new Set(['DUEL', 'DUEL_6', 'DUEL_7', 'PROPERNOUNDLE']);
const TILE = { correct: '#7c3aed', present: '#f59e0b', absent: '#cbd5e1' };

export interface SideRun { run: VsRun & { totalBoards?: number }; guessLog: string[] }

/** One player's board in our colors: guess rows (single-board modes) or one square per board. */
export function MiniBoard({ mode, side, solutions }: { mode: string; side: SideRun; solutions: string[] }) {
  const sq = { width: 16, height: 16, borderRadius: 4 } as const;
  if (SINGLE_BOARD.has(mode) && solutions[0]) {
    const rows = side.guessLog.slice(0, 8);
    if (rows.length === 0) return <div className="text-[10px] font-black" style={{ color: '#9ca3af' }}>NO GUESSES</div>;
    return (
      <div className="flex flex-col" style={{ gap: 3 }}>
        {rows.map((g, r) => (
          <div key={r} className="flex" style={{ gap: 3 }}>
            {rowStates(solutions[0], g).map((s, i) => (
              <span key={i} style={{ ...sq, background: TILE[s], boxShadow: s === 'correct' ? '0 0 5px rgba(124,58,237,0.45)' : undefined }} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  const total = Math.max(1, side.run.totalBoards ?? solutions.length ?? 1);
  return (
    <div className="flex flex-wrap justify-center" style={{ gap: 3, maxWidth: 16 * 7 + 3 * 6 }}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} style={{ ...sq, background: i < side.run.boardsSolved ? TILE.correct : TILE.absent, boxShadow: i < side.run.boardsSolved ? '0 0 5px rgba(124,58,237,0.45)' : undefined }} />
      ))}
    </div>
  );
}

function TopBar({ onClose }: { onClose: () => void }) {
  return (
    <div className="relative flex items-center justify-center" style={{ minHeight: 44 }}>
      <HeaderBack kind="close" onClick={onClose} className="absolute left-0" />
      <span
        className="font-black"
        style={{ fontSize: 20, backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', color: 'transparent' }}
      >
        WORDOCIOUS
      </span>
    </div>
  );
}

const solvedLine = (r: VsRun) => (r.solved ? `SOLVED IN ${r.guesses}` : 'NOT SOLVED');

interface ResultProps {
  mode: string;
  outcome: 'win' | 'loss' | 'draw';
  me: SideRun;
  them: SideRun & { name: string; avatarUrl: string | null };
  solutions: string[];
  h2h: HeadToHeadRecord | null;
  xp: number | null;
  /** A line under the window (§14: the result was saved to send when back online). */
  note?: string | null;
  onClose: () => void;
  onChallengeBack: () => void;
  onHome: () => void;
  onShare: () => void;
}

/** The race result (§5). */
export function ChallengeResult({ mode, outcome, me, them, solutions, h2h, xp, note, onClose, onChallengeBack, onHome, onShare }: ResultProps) {
  const youWon = outcome === 'win';
  const theyWon = outcome === 'loss';
  const left = outcome === 'draw' ? '#ece8ff' : youWon ? '#ebd6fd' : '#e2e6ff';
  const right = outcome === 'draw' ? '#ece8ff' : theyWon ? '#ebd6fd' : '#e2e6ff';
  const margin = vsMargin(me.run, them.run);
  const column = (label: string, side: SideRun, winner: boolean) => (
    <div className="flex-1 flex flex-col items-center gap-2" style={{ padding: '12px 8px 14px' }}>
      <span className="flex items-center gap-1 text-[10px] font-black uppercase truncate max-w-full" style={{ color: '#4c1d95', letterSpacing: 0.8 }}>
        {winner && <Icon3D name="trophy" size={14} className="shrink-0" />}
        {label}
      </span>
      <MiniBoard mode={mode} side={side} solutions={solutions} />
      <span className="font-black" style={{ fontSize: 22, color: '#4c1d95', lineHeight: 1.1 }}>{vsClock(side.run.timeMs)}</span>
      <span className="text-[10px] font-black" style={{ color: '#6d28d9', letterSpacing: 0.6 }}>{solvedLine(side.run)}</span>
    </div>
  );
  const h2hText = h2h ? h2hLine(h2h.myWins, h2h.theirWins).text : null;

  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="max-w-md mx-auto px-4 py-3 space-y-3.5">
        <TopBar onClose={onClose} />

        {/* The result host: S pops on a win, R on a loss, U on a draw. */}
        <ResultHost id={vsResultHost(outcome)} pop={outcome === 'win'} />

        <div className="relative overflow-hidden" style={{ borderRadius: 16, background: `linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${left} 0%, ${left} 50%, ${right} 50%, ${right} 100%)`, boxShadow: '0 4px 14px rgba(76,29,149,0.08)' }}>
          {youWon && (
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
              <div className="absolute" style={{ top: '-20%', left: 0, width: '38%', height: '140%', background: 'linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.55), rgba(255,255,255,0))', animation: 'banner-shimmer 2.6s ease-in-out 1 both' }} />
            </div>
          )}
          <div className="relative flex flex-col gap-1" style={{ padding: '12px 8px 10px 12px', background: 'rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-1.5">
              <Swords className="w-[18px] h-[18px] shrink-0" style={{ color: '#7c3aed' }} />
              {/* YOU WIN! / YOU LOSE / DRAW lettering (docs/ART_SPEC.md §6), the race line under it. */}
              <MomentArt moment={resultMoment(outcome)} as="div" widthPct={85} className="flex-1 min-w-0" />
              <button type="button" onClick={onShare} aria-label="Share the result" className="shrink-0 flex items-center justify-center active:opacity-60" style={{ width: 36, height: 36 }}>
                <Icon3D name="share" size={24} />
              </button>
            </div>
            <span className="text-center font-black" style={{ fontSize: 12.5, letterSpacing: 0.4, lineHeight: 1.2, color: '#4c1d95' }}>{challengeHeadline(outcome, them.name)}</span>
            <div className="flex items-center gap-1.5">
              <ModeGlyph mode={mode} />
              <span className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: '#6d28d9' }}>
                {modeTitle(mode).toUpperCase()} · SAME PUZZLE · {margin}
              </span>
            </div>
          </div>
          <div className="relative flex">
            {column('YOU', me, youWon)}
            {column(`@${them.name}`, them, theyWon)}
          </div>
        </div>

        {note && (
          <p className="text-center text-[12px] font-bold" style={{ color: '#6d28d9' }}>{note}</p>
        )}

        {(h2hText || xp) && (
          <div className="flex items-center gap-3 p-3" style={{ background: '#ffffff', borderRadius: 14, boxShadow: '0 2px 10px rgba(76,29,149,0.07)' }}>
            <InitialAvatar name={them.name} url={them.avatarUrl} size={36} />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase truncate" style={{ color: '#6b7280', letterSpacing: 0.8 }}>YOU AND @{them.name}</div>
              {h2hText && <div className="text-[14px] font-black" style={{ color: '#4c1d95' }}>{h2hText}</div>}
            </div>
            {xp ? (
              <span className="shrink-0 px-2.5 py-1 text-[11px] font-black rounded-full" style={{ background: '#fef3c7', border: '1px solid #fcd34d', color: '#92400e' }}>+{xp} XP</span>
            ) : null}
          </div>
        )}

        <button type="button" onClick={onChallengeBack} className="w-full flex flex-col items-center py-3 text-white transition-transform active:scale-[0.98]" style={{ background: '#7c3aed', borderRadius: 14 }}>
          <span className="text-[15px] font-black" style={{ letterSpacing: 0.6 }}>CHALLENGE BACK</span>
          <span className="text-[11px] font-bold opacity-85">new puzzle, {them.name} races you</span>
        </button>
        <button type="button" onClick={onHome} className="w-full py-3 text-[14px] font-black transition-transform active:scale-[0.98]" style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 14 }}>
          VS HOME
        </button>
      </div>
    </div>
  );
}

function ModeGlyph({ mode }: { mode: string }) {
  return <span className="flex items-center justify-center" style={{ width: 18, height: 18 }}><VsModeIcon mode={mode} size={14} color={modeColor(mode)} /></span>;
}

/** CHALLENGE SENT (§3): the run is stored; friends get 24 hours to race it. */
export function ChallengeSent({ mode, run, guessLog, solutions, code, link, error, onShare, onHome }: {
  mode: string;
  run: VsRun & { totalBoards?: number };
  guessLog: string[];
  solutions: string[];
  code: string | null;
  link: boolean;
  /** Set when the send failed; the screen says so instead of CHALLENGE SENT. */
  error: string | null;
  onShare: () => void;
  onHome: () => void;
}) {
  return (
    <div className="min-h-screen overflow-y-auto" style={{ backgroundColor: '#f8f7ff' }}>
      <div className="max-w-md mx-auto px-4 py-3 space-y-3.5">
        <TopBar onClose={onHome} />
        <div className="relative overflow-hidden" style={{ borderRadius: 16, background: 'linear-gradient(135deg, rgba(255,255,255,0.35), rgba(255,255,255,0) 55%), linear-gradient(180deg, #ebd6fd, #e2e6ff)', boxShadow: '0 4px 14px rgba(76,29,149,0.08)' }}>
          <div className="relative flex flex-col gap-1" style={{ padding: '12px 12px 10px', background: 'rgba(255,255,255,0.5)' }}>
            <div className="flex items-center gap-1.5">
              <Swords className="w-[18px] h-[18px] shrink-0" style={{ color: '#7c3aed' }} />
              <span className="font-black" style={{ fontSize: 16, letterSpacing: 0.4, color: '#4c1d95' }}>{error ? 'CHALLENGE NOT SENT' : 'CHALLENGE SENT!'}</span>
            </div>
            <span className="font-extrabold" style={{ fontSize: 10.5, letterSpacing: 0.4, color: '#6d28d9' }}>
              {error ?? challengeSentSub(mode, run)}
            </span>
          </div>
          <div className="relative flex flex-col items-center gap-2" style={{ padding: '16px 12px' }}>
            <MiniBoard mode={mode} side={{ run, guessLog }} solutions={solutions} />
            <span className="font-black" style={{ fontSize: 22, color: '#4c1d95' }}>{vsClock(run.timeMs)}</span>
            {code && <span className="text-[11px] font-black" style={{ color: '#6d28d9', letterSpacing: 2 }}>CODE {code}</span>}
          </div>
        </div>
        {link && code && !error && (
          <button type="button" onClick={onShare} className="w-full py-3 text-[15px] font-black text-white transition-transform active:scale-[0.98]" style={{ background: '#7c3aed', borderRadius: 14 }}>
            SHARE LINK
          </button>
        )}
        <button type="button" onClick={onHome} className="w-full py-3 text-[14px] font-black transition-transform active:scale-[0.98]" style={{ background: '#ede9fe', color: '#6d28d9', borderRadius: 14 }}>
          VS HOME
        </button>
      </div>
    </div>
  );
}
