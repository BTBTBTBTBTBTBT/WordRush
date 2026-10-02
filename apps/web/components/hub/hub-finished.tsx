'use client';

import type { CSSProperties } from 'react';
import { hubRank, hubRankThreshold, HUB_RANKS, HUB_SOLVED_RANK, type HubState } from '@wordle-duel/core';
import { GameTray } from '@/components/ui/game-tray';
import { pieceSrc } from '@/lib/art';
import { hiveBox, hiveOffsets } from '@/lib/hive-layout';
import { softPill } from '@/lib/soft-surface';

export const HUB_ACCENT = '#c026d3';

// The rank bar and the ended hive's word chips, shared by the game (live and
// other-device boards) and the leaderboard's Completed Today card, which must
// not pull in the puzzle bank the game module imports (founder, 2026-09-29).

export function HubRankBar({ state: s }: { state: HubState }) {
  const rk = hubRank(s), name = HUB_RANKS[rk].name, next = rk < 9 ? hubRankThreshold(rk + 1, s.max) : null;
  return (
    <div className="w-full max-w-md mx-auto px-2">
      <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
        <span className="font-black" style={{ color: HUB_ACCENT }}>{name}</span>
        <span>{s.points} pts{next != null ? ` · ${next - s.points} to ${HUB_RANKS[rk + 1].name}` : ' · maximum'}</span>
      </div>
      <div className="flex items-center gap-1 mt-1" role="progressbar" aria-valuenow={rk} aria-valuemin={0} aria-valuemax={9} aria-label={`Rank ${name}`}>
        {HUB_RANKS.map((r, i) => (
          <div key={r.name} className="flex-1 h-2 rounded-full" style={{ background: i <= rk ? HUB_ACCENT : 'var(--color-border-light)', opacity: i === HUB_SOLVED_RANK && i > rk ? 0.6 : 1, outline: i === HUB_SOLVED_RANK ? `2px solid ${HUB_ACCENT}55` : undefined }} title={r.name} />
        ))}
      </div>
    </div>
  );
}

/** Every word of the puzzle once it has ended: found ones solid (pangrams in the accent), the rest muted. */
export function HubAllWordChips({ state: s }: { state: HubState }) {
  return (
    <>
      {[...s.words, ...s.bonusFound].sort().map((w) => (
        <span key={w} className="text-[11px] font-bold px-2 py-0.5 rounded-full border" style={s.found.includes(w) || s.bonusFound.includes(w)
          ? (s.pangrams.includes(w) ? { background: `${HUB_ACCENT}22`, borderColor: HUB_ACCENT, color: HUB_ACCENT } : { background: 'var(--color-surface)', borderColor: 'var(--color-border)', color: 'var(--color-text)' })
          // A1: the words never found are muted tinted chips (no plain white).
          : { ...softPill('#94a3b8', { bar: false }), color: 'var(--color-text-muted)' }}>{w}{s.pangrams.includes(w) ? ' ★' : ''}</span>
      ))}
    </>
  );
}

const HIVE_OFFSETS = hiveOffsets();
const HIVE_BOX = hiveBox();

/**
 * FINISH_SPEC R2: the ended hive on the finished screen — the same glossy
 * honeycomb as the board (J1), static (no buttons), on the game tray (purple
 * wash once Hubbub was reached, slate below it), at a fixed tile the
 * finished screen's FitBox scales to the room it has.
 */
export function HubHive({ state: s, tile = 52 }: { state: HubState; tile?: number }) {
  const won = s.status === 'won';
  const center = s.letters[0];
  const hex = (ch: string, isCenter: boolean, at?: [number, number]) => (
    <span key={`${ch}-${isCenter ? 'c' : 'o'}`} className="absolute block"
      style={{
        width: tile, height: tile,
        left: `calc(50% - ${tile / 2}px + ${at ? at[0] * tile : 0}px)`,
        top: `calc(50% - ${tile / 2}px + ${at ? at[1] * tile : 0}px)`,
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={pieceSrc(isCenter ? 'hex-center' : 'hex')} alt="" aria-hidden="true" draggable={false} width={256} height={256}
        className="absolute inset-0 w-full h-full pointer-events-none select-none" style={{ filter: 'drop-shadow(0 3px 5px rgba(60, 30, 110, 0.22))' }} />
      <b className="absolute inset-0 flex items-center justify-center font-black uppercase" aria-hidden
        style={{ fontSize: Math.round(tile * 0.42), lineHeight: 1, paddingBottom: Math.round(tile * 0.04), color: isCenter ? '#7a3d00' : '#ffffff',
          textShadow: isCenter ? '0 1px 0 rgba(255, 255, 255, 0.55)' : '0 1px 1px rgba(0, 0, 0, 0.25), 0 2px 3px rgba(40, 10, 80, 0.3)' }}>
        {ch}
      </b>
    </span>
  );
  return (
    <GameTray accent={HUB_ACCENT} state={won ? 'won' : 'lost'} padding={8}>
      <div className="relative" role="img" aria-label={`Hive letters ${s.letters.split('').join(' ')}, center letter ${center}`}
        style={{ width: tile * HIVE_BOX[0], height: tile * HIVE_BOX[1] } as CSSProperties}>
        {hex(center, true)}
        {s.letters.slice(1, 7).split('').map((ch, i) => hex(ch, false, HIVE_OFFSETS[i]))}
      </div>
    </GameTray>
  );
}
