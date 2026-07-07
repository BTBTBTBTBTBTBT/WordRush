'use client';

import { useEffect, useRef } from 'react';
import { playVsStinger } from '@/lib/sounds';
import type { HeadToHeadRecord } from '@/lib/head-to-head';

export interface IntroPlayer {
  username: string;
  avatarUrl: string | null;
  level: number | null;
}

interface MatchIntroProps {
  me: IntroPlayer;
  /** null = anonymous opponent (no userId from the server). */
  opponent: IntroPlayer | null;
  /** null while loading or when the opponent is anonymous. */
  headToHead: HeadToHeadRecord | null;
  onDone: () => void;
}

const INTRO_DURATION_MS = 2500;

export function headToHeadLine(opponentName: string, h2h: HeadToHeadRecord): string {
  if (h2h.myWins === 0 && h2h.theirWins === 0 && h2h.draws === 0) return 'First meeting!';
  if (h2h.myWins > h2h.theirWins) return `You lead ${h2h.myWins}–${h2h.theirWins}`;
  if (h2h.theirWins > h2h.myWins) return `${opponentName} leads ${h2h.theirWins}–${h2h.myWins}`;
  return `Tied ${h2h.myWins}–${h2h.theirWins}`;
}

function IntroAvatar({ player, size = 72 }: { player: IntroPlayer; size?: number }) {
  const initials = (player.username || '?').slice(0, 2).toUpperCase();
  return player.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={player.avatarUrl}
      alt={player.username}
      width={size}
      height={size}
      className="rounded-full object-cover border-2 border-white/40"
      style={{ width: size, height: size }}
    />
  ) : (
    <div
      className="rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center border-2 border-white/40"
      style={{ width: size, height: size }}
    >
      <span className="text-white font-black" style={{ fontSize: size * 0.35 }}>{initials}</span>
    </div>
  );
}

function PlayerCard({ player, side }: { player: IntroPlayer; side: 'left' | 'right' }) {
  return (
    <div
      className="flex flex-col items-center gap-2 w-32"
      // Softer, slower slam than before (0.5s → 0.7s, gentler overshoot) with the
      // opponent card landing a beat later (+0.12s) for a staggered duel clash —
      // mirrors the iOS build-68 match-intro timing.
      style={{ animation: `${side === 'left' ? 'vs-slam-left' : 'vs-slam-right'} 0.7s cubic-bezier(0.3, 1.3, 0.4, 1) ${side === 'left' ? '0s' : '0.12s'} both` }}
    >
      <IntroAvatar player={player} />
      <div className="text-white font-black text-sm text-center truncate w-full">{player.username}</div>
      {player.level != null && (
        <div className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-white/15 border border-white/25 text-white">
          Lv {player.level}
        </div>
      )}
    </div>
  );
}

/**
 * WORDOCIOUS wordmark for the dark VS overlays (clash splash + countdown) —
 * same gradient/weight as the app-header wordmark, rendered at the SAME fixed
 * position on both overlays so it appears not to move across the clash →
 * countdown transition. Shared by MatchIntro and the vs-game countdown.
 */
export function VsOverlayWordmark() {
  return (
    <div className="absolute top-14 left-0 right-0 text-center pointer-events-none select-none">
      <span
        className="text-4xl font-black tracking-tight"
        style={{
          backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          color: 'transparent',
        }}
      >
        WORDOCIOUS
      </span>
    </div>
  );
}

/**
 * Full-screen 2.5s splash shown when a match is found, before the
 * countdown finishes. Skippable on tap. Anonymous opponents render as
 * "Anonymous" with the default-initials avatar and no head-to-head line.
 */
export function MatchIntro({ me, opponent, headToHead, onDone }: MatchIntroProps) {
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    playVsStinger();
    const t = setTimeout(() => finishRef.current(), INTRO_DURATION_MS);
    return () => clearTimeout(t);
  }, []);

  const opp: IntroPlayer = opponent ?? { username: 'Anonymous', avatarUrl: null, level: null };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center backdrop-blur-sm animate-fade-in cursor-pointer"
      style={{ background: 'radial-gradient(circle at center, rgba(30,27,58,0.96), rgba(0,0,0,0.92))' }}
      onClick={finish}
    >
      <VsOverlayWordmark />
      <style>{`
        @keyframes vs-slam-left {
          0% { transform: translateX(-130%); opacity: 0; }
          72% { transform: translateX(6%); opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes vs-slam-right {
          0% { transform: translateX(130%); opacity: 0; }
          72% { transform: translateX(-6%); opacity: 1; }
          100% { transform: translateX(0); opacity: 1; }
        }
        @keyframes vs-pop {
          0% { transform: scale(0) rotate(-12deg); opacity: 0; }
          60% { transform: scale(1.25) rotate(-12deg); opacity: 1; }
          100% { transform: scale(1) rotate(-12deg); opacity: 1; }
        }
        @keyframes vs-h2h-in {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="text-center space-y-6 px-6 w-full max-w-md">
        <div className="flex items-center justify-center gap-3">
          <PlayerCard player={me} side="left" />
          <div
            className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-500 px-1"
            style={{ animation: 'vs-pop 0.55s cubic-bezier(0.3, 1.3, 0.4, 1) 0.5s both' }}
          >
            VS
          </div>
          <PlayerCard player={opp} side="right" />
        </div>

        {opponent && headToHead && (
          <div
            className="text-sm font-extrabold text-white/90"
            style={{ animation: 'vs-h2h-in 0.45s ease-out 0.85s both' }}
          >
            {headToHeadLine(opp.username, headToHead)}
          </div>
        )}

        <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">Tap to skip</p>
      </div>
    </div>
  );
}
