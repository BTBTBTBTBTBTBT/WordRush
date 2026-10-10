'use client';

// THE FRIEND CARDS (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3). One card per friend: their living
// mascot (the green dot + "playing Classic" under it when they are on), "N games waiting on you"
// once, and a compact strip of game tiles (the game's art + one word of state). Tap a tile and you
// are straight in. No per-row PLAY pills, no repeated "vs @name", no bordered boxes. "Their turn"
// games collapse into one quiet line that opens on tap. A friend who is on but has nothing waiting
// shows the six games to start one (tap -> straight in). The ⋯ is the friend's family menu (where
// Resign lives). Words and ordering come from core (friend-cards.ts) so the three apps match.
// iOS: FriendsPanelView.swift · Android: FriendsPanel.kt.

import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, type FriendCard, type FriendlyKind, type GameTile } from '@wordle-duel/core';
import { CandyBadge } from '@/components/ui/candy-badge';
import { FamIcon } from '@/components/ui/family-button';
import { KIND_COLOR } from '@/lib/friends-play';
import { FR_LOOK } from '@/lib/friends-look';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';
import { FlameCount, FriendAvatar, GameGlyph } from './friends-ui';
import type { FriendProfile } from '@/lib/friends-service';

/**
 * The tile strip: up to four tiles share one row, five or six wrap three across, so no tile is ever
 * sliced by the card edge (the old sideways scroller cut the fifth one mid-tile). Same rule as iOS and Android.
 */
function TileGrid({ count, className = '', children, ...rest }: { count: number; className?: string; children: ReactNode } & HTMLAttributes<HTMLDivElement>) {
  const cols = count <= 4 ? Math.max(count, 1) : 3;
  return (
    <div {...rest} className={`grid gap-2 ${className}`.trim()} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, ${count <= 4 ? '104px' : '1fr'}))` }}>
      {children}
    </div>
  );
}

/** One game tile: the game's glossy icon on its soft tint, one word under it. */
function Tile({ tile, quiet, bare, onOpen }: { tile: GameTile; quiet?: boolean; bare?: boolean; onOpen: () => void }) {
  const color = KIND_COLOR[tile.kind];
  return (
    <button data-tile
      type="button"
      onClick={onOpen}
      aria-label={`${FRIENDLY_TITLES[tile.kind]}, ${tile.word}`}
      className="min-w-0 flex flex-col items-center gap-1 active:scale-95 transition-transform"
      style={{ opacity: quiet ? 0.62 : 1 }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 48, height: 48, borderRadius: 14,
          background: softMix(color, tile.yourTurn ? 0.2 : 0.1),
          // A glow, not an outline: it is your move.
          boxShadow: tile.yourTurn ? `0 0 14px 1px ${softMix(color, 0.45)}` : undefined,
        }}
      >
        <GameGlyph kind={tile.kind} size={28} color={color} />
      </span>
      {!bare && (
        <span className="w-full text-center text-[10.5px] font-black leading-[1.1] break-words" style={{ color: tile.yourTurn ? FR_LOOK.ink : FR_LOOK.rowSub }}>
          {tile.word}
        </span>
      )}
    </button>
  );
}

/** The six games as a start strip (a friend with nothing waiting). */
function StartStrip({ onStart }: { onStart: (kind: FriendlyKind) => void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${FRIENDLY_KINDS.length}, minmax(0, 1fr))` }} role="group" aria-label="Start a game">
      {FRIENDLY_KINDS.map((k) => (
        <Tile key={k} bare tile={{ gameId: k, kind: k, word: FRIENDLY_TITLES[k], yourTurn: false }} onOpen={() => onStart(k)} />
      ))}
    </div>
  );
}

export function FriendCards({ cards, profiles, onOpenGame, onStart, onMenu, onProfile }: {
  cards: FriendCard[];
  /** The friend list, to find each card's avatar fields (a game partner who left the list has none). */
  profiles: Map<string, FriendProfile>;
  onOpenGame: (gameId: string) => void;
  onStart: (friendId: string, kind: FriendlyKind) => void;
  onMenu: (friendId: string) => void;
  onProfile: (friendId: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const calm = prefersReducedMotion();
  return (
    <div className="space-y-2.5">
      {cards.map((c) => {
        const f = profiles.get(c.friendId);
        const expanded = !!open[c.friendId];
        return (
          <section
            key={c.friendId}
            aria-label={c.name}
            className="relative"
            style={{ borderRadius: 18, padding: '12px 12px 10px', background: `var(--fr-season-card, ${softMix(c.online ? '#10b981' : FR_LOOK.lavender, c.online ? 0.07 : 0.1)})`, boxShadow: '0 6px 14px rgba(60,30,110,0.07)' }}
          >
            {/* Top line: mascot (with the count badge), name + presence, streak, the ⋯. */}
            <div className="flex items-start gap-2.5">
              <button data-squish type="button" onClick={() => onProfile(c.friendId)} className="relative shrink-0" aria-label={`${c.name}'s profile`}>
                <FriendAvatar
                  name={c.name} userId={c.friendId} url={f?.avatar_url} config={f?.avatar_config} castId={f?.avatar_cast_id}
                  frame={f?.avatar_frame} pro={f?.is_pro} level={f?.level} size={44} online={c.online} pulse={c.online && !calm}
                />
                {c.waiting > 0 && <CandyBadge count={c.waiting} size={16} label={c.headline} style={{ position: 'absolute', top: -6, right: -6 }} />}
              </button>
              <button data-squish type="button" onClick={() => onProfile(c.friendId)} className="flex-1 min-w-0 text-left">
                <span className="block text-[14px] font-black truncate" style={{ color: FR_LOOK.ink }}>@{c.name}</span>
                {c.presence ? (
                  <span className="block text-[11px] font-bold truncate mt-1" style={{ color: 'var(--fr-online, #047857)' }}>{c.presence}</span>
                ) : null}
                {c.headline ? (
                  <span className="block text-[11.5px] font-extrabold truncate mt-0.5" style={{ color: FR_LOOK.bannerClock }}>{c.headline}</span>
                ) : null}
              </button>
              <FlameCount days={f?.friendStreak ?? 0} />
              <button
                type="button"
                onClick={() => onMenu(c.friendId)}
                aria-label={`More options for ${c.name}`}
                aria-haspopup="dialog"
                className="candy candy-sm candy-round shrink-0"
              >
                <FamIcon name="more" size={18} />
              </button>
            </div>

            {/* The strip: your-turn tiles, or the six games to start one. */}
            <div className="mt-2.5">
              {c.tiles.length > 0 ? (
                <TileGrid count={c.tiles.length}>
                  {c.tiles.map((t) => <Tile key={t.gameId} tile={t} onOpen={() => onOpenGame(t.gameId)} />)}
                </TileGrid>
              ) : c.theirTurn.length === 0 ? (
                <StartStrip onStart={(k) => onStart(c.friendId, k)} />
              ) : null}
            </div>

            {/* Their turn: one quiet line; the tiles open on tap. */}
            {c.theirTurn.length > 0 && (
              <div className={c.tiles.length > 0 || c.theirTurn.length > 0 ? 'mt-2' : ''}>
                <button data-squish
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [c.friendId]: !expanded }))}
                  aria-expanded={expanded}
                  className="flex items-center gap-1 text-[11px] font-extrabold"
                  style={{ color: FR_LOOK.rowSub }}
                >
                  {c.theirTurnLine}
                  <ChevronDown className="w-3 h-3 transition-transform" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
                </button>
                {expanded && (
                  <TileGrid count={c.theirTurn.length} className="mt-1.5">
                    {c.theirTurn.map((t) => <Tile key={t.gameId} tile={t} quiet onOpen={() => onOpenGame(t.gameId)} />)}
                  </TileGrid>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
