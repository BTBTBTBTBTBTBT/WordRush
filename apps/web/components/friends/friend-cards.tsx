'use client';

// THE FRIEND CARDS (FRIDAY-QUEUE items 9 + 9e, 2.8 wave 3). One card per friend: their living
// mascot (the green dot + "playing Classic" under it when they are on), "N games waiting on you"
// once (in the accessibility label), and ALWAYS one slim row per game (founder 10-15, docs/design/review/friends-cards-1015/
// SPEC.md: design A + B's WAITING chip): a glossy coin with the game's art, the game's name in caps with its one word under
// it, and a YOUR TURN / WAITING chip. Your-turn rows lead and glow gold (a glow, never an outline); three show, a 4th quiet
// "+N more" row opens the rest. Tap a row and you are straight in; none shows the six games to start one. Each row carries a
// small resign flag that flips the row to "Resign Ghost?" Keep / Resign in place. The ⋯ is the friend's family menu. Words and
// ordering come from core (friend-cards.ts) so the three apps match. iOS: FriendCardsView.swift · Android: FriendsPanel.kt.

import { useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { FRIENDLY_KINDS, FRIENDLY_TITLES, type FriendCard, type FriendlyKind, type GameTile } from '@wordle-duel/core';
import { CandyBadge } from '@/components/ui/candy-badge';
import { FamIcon } from '@/components/ui/family-button';
import { KIND_COLOR } from '@/lib/friends-play';
import { FR_LOOK } from '@/lib/friends-look';
import { prefersReducedMotion } from '@/lib/motion';
import { softMix } from '@/lib/soft-surface';
import { FlameCount, FriendAvatar, GameGlyph } from './friends-ui';
import type { FriendProfile } from '@/lib/friends-service';

const ROW_H = 50;
/** The most game rows a card shows before its quiet "+N more" row. */
const MAX_ROWS = 3;

/** One game tile (only the start strip draws these now): the game's glossy icon on its soft tint, the game's name, then what waits in plain words. */
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

/** The small resign flag at the row's right edge (a 30 px hit area around a 22 px coin). */
function ResignFlag({ title, name, onTap }: { title: string; name: string; onTap: () => void }) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={`Resign ${title} against ${name}`}
      data-squish
      className="relative shrink-0 flex items-center justify-center"
      style={{ width: 30, height: 30, background: 'transparent', border: 0 }}
    >
      <span className="flex items-center justify-center" style={{ width: 22, height: 22, borderRadius: 999, background: 'var(--fr-flag-coin, rgba(255,255,255,0.85))', boxShadow: `inset 0 0 0 1px ${softMix('#db2777', 0.45)}` }}>
        <FamIcon name="flag" size={12} ink="#db2777" />
      </span>
    </button>
  );
}

/** The row turned over, in its own 50 px: "Resign Ghost?" with "They win this one" under it, then Keep and Resign. */
function ResignConfirm({ title, onKeep, onResign }: { title: string; onKeep: () => void; onResign: () => void }) {
  return (
    <div
      role="group"
      aria-label={`Resign ${title}?`}
      className="min-w-0 flex items-center w-full"
      style={{ borderRadius: 14, height: ROW_H, padding: '0 8px 0 10px', gap: 8, background: softMix('#db2777', 0.14) }}
    >
      <FamIcon name="flag" size={18} ink="#db2777" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="text-[12.5px] font-black leading-[1.15] truncate" style={{ color: FR_LOOK.ink }}>Resign {title}?</span>
        <span className="text-[11px] font-bold leading-[1.15] truncate" style={{ color: FR_LOOK.rowSub }}>They win this one</span>
      </span>
      <button
        data-squish
        type="button"
        onClick={onKeep}
        className="shrink-0 text-[11.5px] font-black"
        style={{ height: 26, padding: '0 12px', borderRadius: 999, border: 0, color: FR_LOOK.lavender, background: softMix(FR_LOOK.lavender, 0.18) }}
      >
        Keep
      </button>
      <button
        data-squish
        type="button"
        onClick={onResign}
        className="shrink-0 text-[11.5px] font-black text-white"
        style={{ height: 26, padding: '0 12px', borderRadius: 999, border: 0, background: 'linear-gradient(180deg, #f472b6, #db2777)' }}
      >
        Resign
      </button>
    </div>
  );
}

/** The game's coin: a radial gradient of its accent (light top-left, 25% darker at the rim), a gloss ellipse, the art centered. */
function GameCoin({ kind }: { kind: FriendlyKind }) {
  const c = KIND_COLOR[kind];
  return (
    <span
      className="relative shrink-0 flex items-center justify-center overflow-hidden"
      aria-hidden="true"
      style={{
        width: 34, height: 34, borderRadius: 999,
        background: `radial-gradient(circle at 30% 25%, color-mix(in srgb, ${c} 55%, white) 0%, ${c} 55%, color-mix(in srgb, ${c} 75%, black) 100%)`,
      }}
    >
      <span style={{ position: 'absolute', top: 1, left: '15%', width: '70%', height: '45%', borderRadius: '50%', background: 'rgba(255,255,255,0.22)' }} />
      <span className="relative flex items-center justify-center">
        <GameGlyph kind={kind} size={22} color="#ffffff" />
      </span>
    </span>
  );
}

/** YOUR TURN: the gold candy capsule (a 1 px inner top highlight, never an outline). */
function TurnChip() {
  return (
    <span
      className="shrink-0 flex items-center font-black whitespace-nowrap"
      style={{
        height: 24, padding: '0 10px', borderRadius: 999, fontSize: 10.5, letterSpacing: '0.4px', color: '#5A3200',
        background: 'linear-gradient(180deg, #FFE58A, #F5B21B)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
      }}
    >
      YOUR TURN
    </span>
  );
}

/** WAITING: the dim clock chip. */
function WaitChip() {
  return (
    <span
      className="shrink-0 flex items-center whitespace-nowrap"
      style={{ height: 22, padding: '0 9px', gap: 4, borderRadius: 999, fontSize: 10, fontWeight: 800, letterSpacing: '0.5px', color: FR_LOOK.rowSub, background: 'var(--fr-chip-wait, rgba(124,58,237,0.14))' }}
    >
      <Clock size={9} strokeWidth={2.6} aria-hidden="true" />
      WAITING
    </span>
  );
}

/** One slim game row: the whole row opens the game; the resign flag is its own button. */
function GameRow({ tile, name, confirming, onOpen, onAskResign, onKeep, onResign }: {
  tile: GameTile; name: string; confirming: boolean;
  onOpen: () => void; onAskResign: () => void; onKeep: () => void; onResign: () => void;
}) {
  const title = FRIENDLY_TITLES[tile.kind];
  if (confirming) return <ResignConfirm title={title} onKeep={onKeep} onResign={onResign} />;
  return (
    <div
      className="flex items-center min-w-0"
      style={{
        height: ROW_H, borderRadius: 14, paddingRight: 8,
        background: tile.yourTurn ? 'rgba(255,200,61,0.12)' : 'var(--fr-row-plate, rgba(124,58,237,0.10))',
        boxShadow: tile.yourTurn ? '0 0 8px rgba(255,200,61,0.4)' : undefined,
      }}
    >
      <button
        data-tile
        data-squish
        type="button"
        onClick={onOpen}
        aria-label={`${title}, ${tile.word}`}
        className="flex-1 min-w-0 h-full flex items-center text-left"
        style={{ gap: 10, paddingLeft: 8, background: 'transparent', border: 0 }}
      >
        <GameCoin kind={tile.kind} />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[12.5px] font-black leading-[1.2] truncate uppercase" style={{ color: FR_LOOK.ink }}>{title}</span>
          <span className="text-[11px] font-bold leading-[1.2] truncate" style={{ color: tile.yourTurn ? 'var(--fr-turn-ink, #9a5b00)' : FR_LOOK.rowSub }}>{tile.word}</span>
        </span>
        {tile.yourTurn ? <TurnChip /> : <WaitChip />}
      </button>
      <span style={{ width: 6 }} aria-hidden="true" />
      <ResignFlag title={title} name={name} onTap={onAskResign} />
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

/** The quiet 4th row: "+N more" (or "Show fewer") opens and closes the rest of the games. */
function MoreRow({ hidden, expanded, onToggle }: { hidden: number; expanded: boolean; onToggle: () => void }) {
  return (
    <button
      data-squish
      type="button"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={expanded ? 'Show fewer games' : `Show ${hidden} more ${hidden === 1 ? 'game' : 'games'}`}
      className="w-full flex items-center justify-center text-[11.5px] font-black"
      style={{ gap: 4, height: 28, borderRadius: 999, border: 0, color: FR_LOOK.lavender, background: 'transparent' }}
    >
      {expanded ? 'Show fewer' : `+${hidden} more`}
      <ChevronDown size={11} strokeWidth={3} aria-hidden="true" style={{ transform: expanded ? 'rotate(180deg)' : 'none' }} />
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
        // Your-turn rows first, then theirs (one slim row per game; three show, "+N more" opens the rest).
        const all = [...c.tiles, ...c.theirTurn];
        const folds = all.length > MAX_ROWS;
        const shown = folds && !expanded ? all.slice(0, MAX_ROWS) : all;
        return (
          <section
            key={c.friendId}
            // The bubble headline ("1 game waiting on you") is not drawn on the card (the gold row says it); it stays here for screen readers.
            aria-label={c.headline ? `${c.name}, ${c.headline}` : c.name}
            className="relative"
            style={{ borderRadius: 18, padding: 10, background: `var(--fr-season-card, ${softMix(c.online ? '#10b981' : FR_LOOK.lavender, c.online ? 0.07 : 0.1)})`, boxShadow: '0 6px 14px rgba(60,30,110,0.07)' }}
          >
            {/* Top line: mascot (with the count badge), name + ONE sub line (presence, else the games count), streak, the ⋯. */}
            <div className="flex items-center gap-2.5">
              <button data-squish type="button" onClick={() => onProfile(c.friendId)} className="relative shrink-0" aria-label={`${c.name}'s profile`}>
                <FriendAvatar
                  name={c.name} userId={c.friendId} url={f?.avatar_url} config={f?.avatar_config} castId={f?.avatar_cast_id}
                  frame={f?.avatar_frame} pro={f?.is_pro} level={f?.level} size={44} online={c.online} pulse={c.online && !calm}
                />
                {c.waiting > 0 && <CandyBadge count={c.waiting} size={16} label={c.headline} style={{ position: 'absolute', top: -6, right: -6 }} />}
              </button>
              <button data-squish type="button" onClick={() => onProfile(c.friendId)} className="flex-1 min-w-0 text-left">
                <span className="block text-[16px] font-black leading-[1.2] truncate" style={{ color: FR_LOOK.ink }}>@{c.name}</span>
                {c.presence ? (
                  <span className="block text-[11px] font-bold truncate mt-0.5" style={{ color: 'var(--fr-online, #047857)' }}>{c.presence}</span>
                ) : all.length > 0 ? (
                  <span className="block font-extrabold truncate mt-0.5" style={{ fontSize: 10.5, letterSpacing: '0.6px', color: FR_LOOK.rowSub }}>
                    {all.length === 1 ? '1 GAME' : `${all.length} GAMES`}
                  </span>
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

            {/* One slim row per game (yours first); none shows the six games to start one. */}
            <div className="mt-2 flex flex-col gap-2">
              {all.length > 0 ? (
                <>
                  {shown.map((t) => (
                    <GameRow
                      key={t.gameId}
                      tile={t}
                      name={c.name}
                      confirming={confirming === t.gameId}
                      onOpen={() => onOpenGame(t.gameId)}
                      onAskResign={() => setConfirming(t.gameId)}
                      onKeep={() => setConfirming(null)}
                      onResign={() => { setConfirming(null); onResign(t.gameId); }}
                    />
                  ))}
                  {folds && (
                    <MoreRow hidden={all.length - MAX_ROWS} expanded={expanded} onToggle={() => setOpen((o) => ({ ...o, [c.friendId]: !expanded }))} />
                  )}
                </>
              ) : (
                <StartStrip onStart={(k) => onStart(c.friendId, k)} />
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
