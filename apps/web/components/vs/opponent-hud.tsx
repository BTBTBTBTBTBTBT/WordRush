'use client';

import { createContext, useContext } from 'react';
import { VS } from '@/lib/vs-lobby';
import { OpponentMiniBoard } from './opponent-mini-board';
import { BotAvatar, InitialAvatar } from './vs-ui';

/**
 * Set by vs-game during a challenge-send game (VS overhaul §3): there is no
 * opponent yet, so every mode's HUD reads "YOUR RUN · <who races it>" instead
 * of an empty "Opponent · 0 guesses" strip.
 */
export const VsSoloHudContext = createContext<string | null>(null);

/** Who the strip shows — provided by vs-game (the live opponent, a bot, a friend's run). */
export interface VsOpponentIdentity {
  name: string;
  avatarUrl: string | null;
  /** Bot art in a circle instead of the player avatar. */
  isBot: boolean;
  /** Small tag after the name: "Bot", "Their run". */
  tag?: string;
  typing: boolean;
}

export const VsOpponentContext = createContext<VsOpponentIdentity | null>(null);

interface OpponentHUDProps {
  attempts: number;
  boardsSolved: number;
  totalBoards: number;
  currentStage?: number;
  opponentTiles?: Record<number, string[][]>;
  maxGuesses?: number;
  wordLength?: number;
}

const STRIP_HEIGHT = 52;

/**
 * The compact opponent strip (VS polish §1) — the only VS addition between
 * the solo header and the solo board: avatar, name, a slim teal progress bar
 * (boards solved / total), the guess count and a typing dot; a tiny
 * colors-only board on the right for single-board modes, `2/4 boards` (or
 * Gauntlet's stage) for multi-board ones. Fixed height, so updates never
 * shift the board below.
 */
export function OpponentHUD({ attempts, boardsSolved, totalBoards, currentStage, opponentTiles, maxGuesses = 6, wordLength = 5 }: OpponentHUDProps) {
  const solo = useContext(VsSoloHudContext);
  const who = useContext(VsOpponentContext);

  if (solo) {
    return (
      <div
        className="w-full max-w-md mx-auto flex items-center gap-3 px-4 animate-fade-in-up"
        style={{ height: STRIP_HEIGHT, background: VS.soft, borderRadius: 14 }}
      >
        <span className="text-[11px] font-black uppercase shrink-0" style={{ color: VS.ink, letterSpacing: 1 }}>Your run</span>
        <div className="h-4 w-px shrink-0" style={{ background: 'rgba(15, 118, 110, 0.25)' }} />
        <span className="text-[12px] font-bold truncate" style={{ color: VS.deep }}>{solo}</span>
      </div>
    );
  }

  const name = who?.name || 'Opponent';
  const total = Math.max(1, totalBoards);
  const progress = Math.min(1, boardsSolved / total);
  const single = totalBoards <= 1 && currentStage === undefined;
  // Strip-sized mini board: the full frame fits inside the strip's height.
  const miniTile = Math.max(3, Math.min(6, Math.floor((STRIP_HEIGHT - 12 - (maxGuesses - 1)) / maxGuesses)));

  return (
    <div
      className="w-full max-w-md mx-auto flex items-center gap-2.5 px-3"
      style={{ height: STRIP_HEIGHT, background: '#ffffff', borderRadius: 14, boxShadow: VS.cardShadow }}
      aria-label={`${name}: ${attempts} ${attempts === 1 ? 'guess' : 'guesses'}${single ? '' : `, ${boardsSolved} of ${totalBoards} boards`}`}
    >
      {who?.isBot && who.avatarUrl ? (
        <BotAvatar src={who.avatarUrl} name={name} size={32} bg={VS.soft} />
      ) : (
        <InitialAvatar name={name} url={who?.avatarUrl ?? null} size={32} />
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[12.5px] font-black truncate" style={{ color: VS.deep }}>{name}</span>
          {who?.tag && (
            <span className="text-[10.5px] font-bold shrink-0" style={{ color: VS.label }}>· {who.tag}</span>
          )}
          {/* Typing dot — always mounted (opacity toggle) so nothing shifts. */}
          <span
            className={`flex gap-0.5 items-center shrink-0 transition-opacity duration-200 ${who?.typing ? 'opacity-100' : 'opacity-0'}`}
            aria-hidden="true"
          >
            {[0, 1, 2].map((i) => (
              <span key={i} className="w-1 h-1 rounded-full animate-pulse" style={{ background: VS.ink, animationDelay: `${i * 0.2}s` }} />
            ))}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: VS.soft }}>
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: VS.ink, transition: 'width 500ms ease' }} />
          </div>
          <span className="text-[10.5px] font-bold shrink-0 tabular-nums" style={{ color: VS.label }}>
            {attempts} {attempts === 1 ? 'guess' : 'guesses'}
          </span>
        </div>
      </div>
      {single ? (
        <OpponentMiniBoard tiles={opponentTiles?.[0] || []} maxGuesses={maxGuesses} wordLength={wordLength} tileSize={miniTile} />
      ) : (
        <span className="text-[11px] font-black shrink-0 tabular-nums text-right" style={{ color: VS.ink }}>
          {currentStage !== undefined ? `Stage ${currentStage + 1}/5` : `${boardsSolved}/${totalBoards} boards`}
        </span>
      )}
    </div>
  );
}
