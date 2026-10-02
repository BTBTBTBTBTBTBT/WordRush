'use client';

import { useEffect, useRef } from 'react';
import { playVsStinger } from '@/lib/sounds';
import type { HeadToHeadRecord } from '@/lib/head-to-head';
import { VS } from '@/lib/vs-lobby';
import { ModeChip, VsPill } from './vs-ui';

export interface IntroPlayer {
  username: string;
  avatarUrl: string | null;
  level: number | null;
  /** Bot art (contained in a soft circle) instead of a photo. */
  art?: boolean;
}

interface MatchIntroProps {
  me: IntroPlayer;
  /** null = anonymous opponent (no userId from the server). */
  opponent: IntroPlayer | null;
  /** null while loading or when the opponent is anonymous. */
  headToHead: HeadToHeadRecord | null;
  /** The match's mode (db key) for the mode chip. */
  mode?: string;
  onDone: () => void;
}

// Exported so vs-game can anchor its shared input-lock timeline to the FULL
// un-skipped intro length — tapping to skip only skips the visuals.
export const INTRO_DURATION_MS = 2500;

export function headToHeadLine(opponentName: string, h2h: HeadToHeadRecord): string {
  if (h2h.myWins === 0 && h2h.theirWins === 0 && h2h.draws === 0) return 'First meeting!';
  if (h2h.myWins > h2h.theirWins) return `You lead ${h2h.myWins}–${h2h.theirWins}`;
  if (h2h.theirWins > h2h.myWins) return `${opponentName} leads ${h2h.theirWins}–${h2h.myWins}`;
  return `Tied ${h2h.myWins}–${h2h.theirWins}`;
}

function IntroAvatar({ player, size = 76 }: { player: IntroPlayer; size?: number }) {
  const initials = (player.username || '?').slice(0, 2).toUpperCase();
  const ring = '0 0 0 3px #ffffff, 0 6px 16px rgba(76,29,149,0.14)';
  if (player.avatarUrl) {
    return (
      <span className="rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ width: size, height: size, background: player.art ? VS.soft : '#ffffff', boxShadow: ring }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={player.avatarUrl}
          alt={player.username}
          className={player.art ? 'object-contain' : 'object-cover rounded-full'}
          style={player.art ? { width: size * 0.9, height: size * 0.9 } : { width: size, height: size }}
        />
      </span>
    );
  }
  return (
    <span className="rounded-full flex items-center justify-center shrink-0" style={{ width: size, height: size, background: '#ede9fe', boxShadow: ring }}>
      <span className="font-black" style={{ fontSize: size * 0.34, color: '#6d28d9' }}>{initials}</span>
    </span>
  );
}

function PlayerCard({ player, side }: { player: IntroPlayer; side: 'left' | 'right' }) {
  return (
    <div
      className="flex-1 min-w-0 flex flex-col items-center gap-2"
      // Softer, slower slam (0.7s, gentle overshoot) with the opponent card
      // landing a beat later (+0.12s) for a staggered duel clash — mirrors
      // the iOS build-68 match-intro timing.
      style={{ animation: `${side === 'left' ? 'vs-slam-left' : 'vs-slam-right'} 0.7s cubic-bezier(0.3, 1.3, 0.4, 1) ${side === 'left' ? '0s' : '0.12s'} both` }}
    >
      <IntroAvatar player={player} />
      <div className="font-black text-[14px] uppercase text-center truncate w-full" style={{ color: side === 'left' ? VS.deep : '#4c1d95', letterSpacing: 0.4 }}>
        {player.username}
      </div>
      {player.level != null && (
        <div className="px-2 py-0.5 rounded-full text-[10px] font-black" style={{ background: 'rgba(255,255,255,0.7)', color: '#6d28d9' }}>
          LV {player.level}
        </div>
      )}
    </div>
  );
}

/**
 * The 2.5s match-found splash (VS polish §2), in the home / VS aesthetic: a
 * teal / purple one-window card with you and them facing each other, names
 * in caps, the head-to-head line and the mode chip. Skippable on tap.
 * Anonymous opponents render as "Anonymous" with the initials avatar and no
 * head-to-head line.
 */
export function MatchIntro({ me, opponent, headToHead, mode, onDone }: MatchIntroProps) {
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
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 animate-fade-in cursor-pointer"
      style={{ background: VS.page, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onClick={finish}
    >
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
          0% { transform: scale(0); opacity: 0; }
          60% { transform: scale(1.3); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes vs-h2h-in {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <div className="w-full max-w-sm space-y-4 text-center">
        <div
          className="relative overflow-hidden"
          style={{ borderRadius: 18, background: 'linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 55%), linear-gradient(90deg, #ccfbf1 0%, #ccfbf1 50%, #ede9fe 50%, #ede9fe 100%)', boxShadow: '0 6px 20px rgba(76,29,149,0.10)' }}
        >
          <div className="flex items-center justify-center gap-2" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.5)' }}>
            <span className="text-[12px] font-black uppercase" style={{ color: VS.ink, letterSpacing: 1.4 }}>Match found</span>
            {mode && <ModeChip mode={mode} />}
          </div>
          <div className="flex items-center gap-1 px-3" style={{ padding: '20px 10px 18px' }}>
            <PlayerCard player={me} side="left" />
            <div className="shrink-0" style={{ animation: 'vs-pop 0.55s cubic-bezier(0.3, 1.3, 0.4, 1) 0.5s both' }}>
              <span className="inline-block" style={{ transform: 'scale(1.4)' }}><VsPill /></span>
            </div>
            <PlayerCard player={opp} side="right" />
          </div>
          {opponent && headToHead && (
            <div
              className="text-[14px] font-black pb-4"
              style={{ color: '#4c1d95', animation: 'vs-h2h-in 0.45s ease-out 0.85s both' }}
            >
              {headToHeadLine(opp.username, headToHead)}
            </div>
          )}
        </div>

        <p className="text-[10.5px] font-black uppercase" style={{ color: VS.label, letterSpacing: 1.4 }}>Tap to skip</p>
      </div>
    </div>
  );
}
