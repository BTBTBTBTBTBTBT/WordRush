'use client';

import { hubRank, hubRankThreshold, HUB_RANKS, HUB_SOLVED_RANK, type HubState } from '@wordle-duel/core';

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
          : { background: '#f9fafb', borderColor: '#e5e7eb', color: '#9ca3af' }}>{w}{s.pangrams.includes(w) ? ' ★' : ''}</span>
      ))}
    </>
  );
}
