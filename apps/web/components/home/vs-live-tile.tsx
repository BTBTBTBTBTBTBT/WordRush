'use client';

import { Swords } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import type { HomeCard } from './mode-chrome';
import { MODE_CARD, ModeCardBand, TitleLineSlot, modeCardSurface } from './mode-card';

// VS Battle as a full-width tile at the very bottom of the game area (founder +
// JP, 2026-09-26): the VS card and the old LIVE strip merged — VS icon and
// accent, "VS Battle", the live pulse + player count, Invite for Pro. The
// grid above is exactly the eight sweep games. Tap = the VS card's action.
// Styled as a Home game card (docs/ART_SPEC.md §21.5).

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
    // §21.5: the Home game cards' exact treatment (surface, radius, border,
    // shadow, inner padding, 10 px top band) in the VS accent; the
    // W / L badge sits at the end of the title line (§21.1).
    <div
      className="relative w-full shrink-0 overflow-hidden"
      style={modeCardSurface(accent, { done })}
      role="group"
      aria-label="VS Battle"
    >
      <ModeCardBand accent={accent} />
      <div className="flex items-center gap-3" style={{ padding: `${MODE_CARD.padY}px ${MODE_CARD.padX}px` }}>
        <button type="button" onClick={onOpen} className="flex-1 min-w-0 flex items-center gap-3 text-left transition-transform active:scale-[0.98]" aria-label="Open VS Battle">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
            <Icon className="w-5 h-5" style={{ color: accent }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <div className="flex-1 min-w-0 truncate text-[13px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{card.title}</div>
              {done && (
                <TitleLineSlot line={16}>
                  <Icon3D name={vsDailyWon ? 'badge-w' : 'badge-l'} size={MODE_CARD.badge} label={vsDailyWon ? 'Won' : 'Lost'} />
                </TitleLineSlot>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shrink-0" />
              <span className="text-[10px] font-black" style={{ color: 'var(--color-text)' }}>LIVE</span>
              <span className="text-[10px] font-bold truncate" style={{ color: 'var(--color-text-muted)' }}>· {countText}</span>
            </div>
            <div className="text-[10px] font-bold leading-tight" style={{ color: 'var(--color-text-muted)' }}>{subtitle}</div>
          </div>
        </button>
        {isPro && (
          // A soft pill in the tile's own teal (founder, 2026-10-01: the hot-pink 3D button looked out of place).
          <button
            type="button"
            onClick={onInvite}
            className="flex items-center gap-1 px-3 font-black text-[11px] rounded-full transition-transform active:scale-95 shrink-0"
            style={{ height: 32, background: `${accent}14`, border: `1.5px solid ${accent}55`, color: '#0f766e' }}
          >
            <Icon3D name="add-friend" size={17} />
            Invite
          </button>
        )}
      </div>
    </div>
  );
}
