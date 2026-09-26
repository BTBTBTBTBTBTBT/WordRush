'use client';

import { ChevronRight, Swords } from 'lucide-react';
import type { HomeCard } from './mode-chrome';

// VS Battle as a full-width tile at the very bottom of the game area (founder +
// JP, 2026-09-26): the VS card and the old LIVE strip merged — VS icon and
// accent, "VS Battle", the live pulse + player count, Invite for Pro. The
// grid above is exactly the eight sweep games. Tap = the VS card's action.

interface Props {
  card: HomeCard;
  /** null while the presence endpoint has not answered yet. */
  livePlayerCount: number | null;
  /** Today's daily VS result: true won, false lost, null not played (Daily mode only). */
  vsDailyWon: boolean | null;
  playMode: 'daily' | 'unlimited';
  isPro: boolean;
  onOpen: () => void;
  onInvite: () => void;
}

export function VSLiveTile({ card, livePlayerCount, vsDailyWon, playMode, isPro, onOpen, onInvite }: Props) {
  const accent = card.accentColor;
  const done = playMode === 'daily' && vsDailyWon !== null;
  const countText = livePlayerCount === null
    ? 'Players online'
    : `${livePlayerCount.toLocaleString()} ${livePlayerCount === 1 ? 'player' : 'players'} online`;
  const subtitle = done
    ? (vsDailyWon ? "Today's battle won" : "Today's battle lost")
    : playMode === 'daily' ? "Today's shared battle" : card.desc;
  const Icon = card.icon ?? Swords;

  return (
    <div
      className="relative w-full shrink-0 overflow-hidden flex items-center gap-3 px-3 py-2.5"
      style={{
        background: done ? `${accent}0f` : 'var(--color-surface)',
        border: `1.5px solid ${done ? `${accent}66` : 'var(--color-border)'}`,
        borderRadius: '14px',
      }}
      role="group"
      aria-label="VS Battle"
    >
      <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: `linear-gradient(180deg, ${accent}, ${accent}88)` }} />
      <button type="button" onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left transition-transform active:scale-[0.98]" aria-label="Open VS Battle">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
          <Icon className="w-5 h-5" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{card.title}</span>
            {done && (
              <span className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: vsDailyWon ? '#7c3aed' : '#dc2626' }}>
                <span className="text-[10px] font-black text-white leading-none">{vsDailyWon ? 'W' : 'L'}</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
            <span className="text-[10px] font-black" style={{ color: 'var(--color-text)' }}>LIVE</span>
            <span className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>· {countText}</span>
          </div>
          <div className="text-[10px] font-bold leading-tight" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</div>
        </div>
        <ChevronRight className="w-5 h-5 shrink-0" style={{ color: accent }} />
      </button>
      {isPro && (
        <button
          type="button"
          onClick={onInvite}
          className="btn-3d px-3 py-1.5 text-white font-black text-[10px] rounded-md transition-transform active:scale-95 shrink-0"
          style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)', boxShadow: '0 2px 0 #9f1239' }}
        >
          Invite
        </button>
      )}
    </div>
  );
}
