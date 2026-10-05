'use client';

import { useEffect, useRef } from 'react';
import { playVsStinger } from '@/lib/sounds';
import type { HeadToHeadRecord } from '@/lib/head-to-head';
import { VS } from '@/lib/vs-lobby';
import { PlayerAvatar } from '@/components/avatar/player-avatar';
import { SoftNum } from '@/components/ui/soft-number';
import { botPersona } from '@/lib/bot/bot-personas';
import { alphaHex } from '@/lib/soft-surface';
import { BotFigure, GhostAvatar, ModeChip, VS_ACCENT, VsPill, vsCard } from './vs-ui';
import { HeadingArt } from '@/components/ui/heading-art';

export interface IntroPlayer {
  username: string;
  avatarUrl: string | null;
  level: number | null;
  /** Bot art (contained in a soft circle) instead of a photo. */
  art?: boolean;
  /** A cast bot (D1): drawn as its own character in the 'ready' pose. */
  botId?: string;
  /** Your Ghost: a faded version of the player's own letter tile (`ghostName`, `emoji`, `accent`). */
  ghost?: boolean;
  ghostName?: string;
  /** A small line under the name ("Medium · Solves in 4–5"). */
  tag?: string;
  /** Letter-tile extras (ART_SPEC §20), when known: chosen emoji + profile accent. */
  emoji?: string | null;
  accent?: string | null;
  /** FINISH_SPEC AH (legacy): the player's avatar_cast_id when the data carries it (the signed-in player's own is always used). */
  castId?: string | null;
  /** FINISH_SPEC AN3: the player's user id (matches the signed-in player), avatar_config and Pro flag when known. */
  userId?: string | null;
  avatarConfig?: unknown;
  pro?: boolean | null;
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
  const ring = '0 0 0 3px #ffffff, 0 6px 16px rgba(76,29,149,0.14)';
  // The bot's own character, full figure, a little bigger than a tile (D3).
  if (player.botId) return <BotFigure id={player.botId} pose="ready" size={size * 1.3} style={{ margin: -size * 0.12 }} />;
  if (player.ghost) return <GhostAvatar name={player.ghostName ?? 'You'} accent={player.accent} size={size} />;
  if (player.art && player.avatarUrl) {
    // Bot art (not a player photo) stays in its soft circle.
    return (
      <span className="rounded-full flex items-center justify-center overflow-hidden shrink-0" style={{ width: size, height: size, background: VS.soft, boxShadow: ring }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={player.avatarUrl} alt={player.username} width={Math.round(size * 0.9)} height={Math.round(size * 0.9)} className="object-contain" style={{ width: size * 0.9, height: size * 0.9 }} />
      </span>
    );
  }
  // FINISH_SPEC AN5 / AN6: the player's photo (rounded square) or their mascot, in their frame.
  return (
    <PlayerAvatar
      name={player.username}
      userId={player.userId}
      url={player.avatarUrl}
      accent={player.accent}
      config={player.avatarConfig}
      castId={player.castId}
      level={player.level}
      pro={player.pro}
      size={size}
      shadow={ring}
      label={player.username}
    />
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
      {player.tag && (
        <div className="text-[10.5px] font-extrabold text-center" style={{ color: 'var(--vs-sub, #4b5563)' }}>{player.tag}</div>
      )}
      {player.level != null && (
        <div className="inline-flex items-baseline gap-1 px-2 py-0.5 text-[10px] font-black" style={{ ...vsCard('#7c3aed', { radius: 999, shadow: false }), color: 'var(--vs-purple-sub, #6d28d9)' }}>
          LV <SoftNum size={13}>{player.level}</SoftNum>
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
  // The versus card: your half in the VS teal, theirs in the bot's own color (or purple).
  const theirs = opp.botId ? botPersona(opp.botId).color : '#7c3aed';

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-4 animate-fade-in cursor-pointer"
      style={{ background: `radial-gradient(circle at 50% 40%, #ffffff 0%, ${VS.page} 45%, #e6f7f4 100%)`, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
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
          style={{
            ...vsCard(VS_ACCENT, { radius: 20 }),
            background: `linear-gradient(135deg, rgba(255,255,255,0.4), rgba(255,255,255,0) 55%), linear-gradient(90deg, ${alphaHex(VS_ACCENT, 0.16)} 0%, ${alphaHex(VS_ACCENT, 0.16)} 50%, ${alphaHex(theirs, 0.16)} 50%, ${alphaHex(theirs, 0.16)} 100%), var(--vs-card-base, #ffffff)`,
          }}
        >
          {/* The top bar: your color, then theirs. */}
          <div aria-hidden="true" style={{ height: 10, background: `linear-gradient(90deg, ${VS_ACCENT} 0%, ${VS_ACCENT} 50%, ${theirs} 50%, ${theirs} 100%)` }} />
          <div className="flex items-center justify-center gap-2" style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.5)' }}>
            {/* BJ16: the MATCH FOUND! lettering, not a caps label. */}
            <HeadingArt slug="matchfound" height={26} maxWidth={170} />
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
              style={{ color: 'var(--vs-purple-ink, #4c1d95)', animation: 'vs-h2h-in 0.45s ease-out 0.85s both' }}
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
