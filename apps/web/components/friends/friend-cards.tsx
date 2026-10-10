'use client';

// THE FRIEND CARDS (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3). One card per friend: their living
// mascot (the green dot + "playing Classic" under it when they are on), "N games waiting on you"
// once, and a compact strip of game tiles (the game's art + one word of state). Tap a tile and you
// are straight in. No per-row PLAY pills, no repeated "vs @name", no bordered boxes. Founder 10-09: a friend with
// several games folds them into ONE "Pick a game" dropdown (the games' art overlapping, the first titles, a chevron);
// it opens the tiles (yours first, theirs quiet). One game shows its tile; none shows the six games to start one
// (tap -> straight in). Each tile carries a small resign flag that flips the tile to "Resign Ghost?" Keep / Resign in
// place. The ⋯ is the friend's family menu. Words and ordering come from core (friend-cards.ts) so the three apps match.
// iOS: FriendsPanelView.swift · Android: FriendsPanel.kt.

import { useState, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, type FriendCard, type FriendlyKind, type GameTile } from '@wordle-duel/core';
import { CandyBadge } from '@/components/ui/candy-badge';
import { FamIcon } from '@/components/ui/family-button';
import { gamesSubtitle } from '@/lib/friend-card-copy';
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

/** One game tile: the game's glossy icon on its soft tint, the game's name, then what waits in plain words. */
function Tile({ tile, quiet, bare, onOpen }: { tile: GameTile; quiet?: boolean; bare?: boolean; onOpen: () => void }) {
  const color = KIND_COLOR[tile.kind];
  return (
    <button data-tile
      type="button"
      onClick={onOpen}
      aria-label={`${FRIENDLY_TITLES[tile.kind]}, ${tile.word}`}
      className="min-w-0 flex flex-col items-center gap-[3px] active:scale-95 transition-transform"
      style={{ opacity: quiet ? 0.62 : 1 }}
    >
      <span
        className="flex items-center justify-center"
        style={{
          width: 44, height: 44, borderRadius: 13,
          background: softMix(color, tile.yourTurn ? 0.2 : 0.1),
          // A glow, not an outline: it is your move.
          boxShadow: tile.yourTurn ? `0 0 14px 1px ${softMix(color, 0.45)}` : undefined,
        }}
      >
        <GameGlyph kind={tile.kind} size={26} color={color} />
      </span>
      {!bare && (
        <>
          {/* Founder 10-09: the game's NAME, then what waits in plain words (up to two lines), never a cryptic two-word state. */}
          <span className="w-full text-center text-[12px] font-black leading-[1.1] truncate" style={{ color: tile.yourTurn ? FR_LOOK.ink : FR_LOOK.rowSub }}>
            {FRIENDLY_TITLES[tile.kind]}
          </span>
          <span
            className="w-full text-center text-[10.5px] font-bold leading-[1.15] break-words"
            style={{ color: tile.yourTurn ? FR_LOOK.ink : FR_LOOK.rowSub, opacity: tile.yourTurn ? 0.85 : 1, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {tile.word}
          </span>
        </>
      )}
    </button>
  );
}

/** The small resign flag in a tile's corner (a 30 px hit area around a 22 px coin). */
function ResignFlag({ title, name, onTap }: { title: string; name: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Resign ${title} against ${name}`}
      data-squish
      className="absolute flex items-center justify-center"
      style={{ top: -3, right: -3, width: 30, height: 30, background: 'transparent', border: 0 }}
    >
      <span className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--fr-flag-coin, rgba(255,255,255,0.85))', boxShadow: `inset 0 0 0 1px ${softMix('#db2777', 0.45)}` }}>
        <FamIcon name="flag" size={12} ink="#db2777" />
      </span>
    </button>
  );
}

/** The tile turned over: "Resign Ghost?", then Keep and Resign side by side, in the tile's own place. */
function ResignConfirm({ title, onKeep, onResign }: { title: string; onKeep: () => void; onResign: () => void }) {
  return (
    <div
      role="group"
      aria-label={`Resign ${title}?`}
      className="min-w-0 flex flex-col items-center justify-center gap-1.5 w-full"
      style={{ borderRadius: 14, padding: '8px 6px', background: softMix('#db2777', 0.14), minHeight: 96 }}
    >
      <FamIcon name="flag" size={20} ink="#db2777" />
      <span className="w-full text-center text-[12px] font-black leading-[1.1] line-clamp-2" style={{ color: FR_LOOK.ink }}>Resign {title}?</span>
      <span className="w-full text-center text-[10px] font-bold truncate" style={{ color: FR_LOOK.rowSub }}>They win this one</span>
      <span className="flex w-full gap-[5px]">
        <button
          data-squish
          type="button"
          onClick={onKeep}
          className="flex-1 text-[11.5px] font-black"
          style={{ height: 26, borderRadius: 999, border: 0, color: FR_LOOK.lavender, background: softMix(FR_LOOK.lavender, 0.18) }}
        >
          Keep
        </button>
        <button
          data-squish
          type="button"
          onClick={onResign}
          className="flex-1 text-[11.5px] font-black text-white"
          style={{ height: 26, borderRadius: 999, border: 0, background: 'linear-gradient(180deg, #f472b6, #db2777)' }}
        >
          Resign
        </button>
      </span>
    </div>
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

/** The folded games: their art overlapping, "Pick a game" with the first titles under it, and a chevron. Tap opens the tiles. */
function GamesDropdown({ tiles, expanded, accent, onToggle }: { tiles: GameTile[]; expanded: boolean; accent: string; onToggle: () => void }) {
  const line = `${tiles.length} games`;
  return (
    <button
      data-squish
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={`${line}. ${expanded ? 'Hides the games' : 'Shows the games to pick from'}`}
      className="w-full flex items-center text-left"
      style={{ gap: 10, padding: '8px 10px', borderRadius: 16, border: 0, background: softMix(accent, 0.1) }}
    >
      <span className="flex items-center shrink-0" aria-hidden="true">
        {tiles.slice(0, 4).map((t, i) => (
          <span
            key={t.gameId}
            className="flex items-center justify-center"
            style={{
              width: 34, height: 34, borderRadius: 999, marginLeft: i === 0 ? 0 : -10, zIndex: 10 - i, position: 'relative',
              background: `linear-gradient(${softMix(KIND_COLOR[t.kind], 0.22)}, ${softMix(KIND_COLOR[t.kind], 0.22)}), var(--fr-season-card, #ffffff)`,
            }}
          >
            <GameGlyph kind={t.kind} size={26} color={KIND_COLOR[t.kind]} />
          </span>
        ))}
      </span>
      <span className="flex-1 min-w-0">
        {/* The header already says how many wait on you; the dropdown names the games (no repeat). */}
        <span className="block text-[13px] font-black truncate" style={{ color: FR_LOOK.ink }}>Pick a game</span>
        {!expanded && (
          <span className="block text-[10.5px] font-bold truncate" style={{ color: FR_LOOK.rowSub }}>
            {gamesSubtitle(tiles.map((t) => FRIENDLY_TITLES[t.kind]))}
          </span>
        )}
      </span>
      <span className="flex items-center justify-center shrink-0" style={{ width: 28, height: 28, borderRadius: 999, background: softMix(accent, 0.16) }}>
        <ChevronDown className="w-3.5 h-3.5 transition-transform" style={{ color: accent, transform: expanded ? 'rotate(180deg)' : 'none' }} aria-hidden="true" />
      </span>
    </button>
  );
}

export function FriendCards({ cards, profiles, onOpenGame, onStart, onMenu, onProfile, onResign }: {
  cards: FriendCard[];
  /** The friend list, to find each card's avatar fields (a game partner who left the list has none). */
  profiles: Map<string, FriendProfile>;
  onOpenGame: (gameId: string) => void;
  onStart: (friendId: string, kind: FriendlyKind) => void;
  onMenu: (friendId: string) => void;
  onProfile: (friendId: string) => void;
  /** Resign this game (the confirm happens on its tile; the caller resigns and reloads the games). */
  onResign: (gameId: string) => void;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  /** The tile whose flag was tapped (it shows "Resign?" with Keep / Resign in place). */
  const [confirming, setConfirming] = useState<string | null>(null);
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

            {/* Several games fold into one dropdown; one game shows its tile; none shows the six games to start one. */}
            {(() => {
              const all = [...c.tiles, ...c.theirTurn];
              const cell = (t: GameTile) => (
                <div key={t.gameId} className="relative min-w-0">
                  {confirming === t.gameId ? (
                    <ResignConfirm
                      title={FRIENDLY_TITLES[t.kind]}
                      onKeep={() => setConfirming(null)}
                      onResign={() => { setConfirming(null); onResign(t.gameId); }}
                    />
                  ) : (
                    <>
                      <Tile tile={t} quiet={!t.yourTurn} onOpen={() => onOpenGame(t.gameId)} />
                      <ResignFlag title={FRIENDLY_TITLES[t.kind]} name={c.name} onTap={() => setConfirming(t.gameId)} />
                    </>
                  )}
                </div>
              );
              const strip = (tiles: GameTile[]) => (
                <TileGrid count={tiles.length} className={all.length >= 2 ? 'mt-2' : ''}>{tiles.map(cell)}</TileGrid>
              );
              return (
                <div className="mt-2.5">
                  {all.length >= 2 ? (
                    <>
                      <GamesDropdown tiles={all} expanded={expanded} accent={c.waiting > 0 ? FR_LOOK.pink : FR_LOOK.lavender} onToggle={() => setOpen((o) => ({ ...o, [c.friendId]: !expanded }))} />
                      {expanded && strip(all)}
                    </>
                  ) : all.length === 1 ? (
                    strip(all)
                  ) : (
                    <StartStrip onStart={(k) => onStart(c.friendId, k)} />
                  )}
                </div>
              );
            })()}
          </section>
        );
      })}
    </div>
  );
}
