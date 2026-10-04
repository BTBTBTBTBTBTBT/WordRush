'use client';

import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { BRAND_ACCENT, SOFT_INK, alphaHex, softCard, softPill } from '@/lib/soft-surface';
import type { GroupProgress } from '@wordle-duel/core';
import type { HomeCard } from './mode-chrome';

// Desktop website only (≥ 1024 px; hidden below by globals.css .dk-only): the
// Home hero's right half beside the banner — today's progress at a glance in
// the same tinted-card language (A1 wash + the purple → pink top bar, A2 soft
// numbers, A8 candy button): DAILIES and PUZZLES tiles (played / total, a
// static progress bar, wins) and one candy action (play the next unplayed daily). BJ6: the
// countdown, streak and share live once each elsewhere on Home (banner meta line, header).

const DAILIES_ACCENT = '#7c3aed';
const PUZZLES_ACCENT = '#f59e0b';

function ProgressTile({ label, accent, progress, unlimited, unlimitedPlayed }: {
  label: string;
  accent: string;
  progress: GroupProgress;
  unlimited: boolean;
  unlimitedPlayed: number;
}) {
  const pct = progress.total > 0 ? Math.min(100, Math.round((progress.played / progress.total) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1.5" style={{ ...softPill(accent, { radius: 16 }), padding: '12px 12px 11px' }}>
      <span className="text-[10px] font-black uppercase" style={{ letterSpacing: '0.12em', color: SOFT_INK.label }}>{label}</span>
      {unlimited ? (
        <span className="flex items-baseline gap-1.5">
          <SoftNum size={26}>{unlimitedPlayed}</SoftNum>
          <span className="text-[11px] font-extrabold" style={{ color: SOFT_INK.detail }}>played today</span>
        </span>
      ) : (
        <>
          <span className="flex items-baseline gap-1">
            <SoftNum size={26}>{progress.played}</SoftNum>
            <span className="text-[13px] font-black" style={{ color: SOFT_INK.detail }}>/ {progress.total}</span>
            {progress.played > 0 && (
              <span className="ml-auto text-[11px] font-extrabold" style={{ color: SOFT_INK.detail }}>{progress.won} won</span>
            )}
          </span>
          <span aria-hidden="true" className="block overflow-hidden" style={{ height: 6, borderRadius: 999, background: alphaHex(accent, 0.16) }}>
            <span className="block h-full" style={{ width: `${pct}%`, borderRadius: 999, background: `linear-gradient(90deg, ${alphaHex(accent, 0.75)}, ${accent})` }} />
          </span>
        </>
      )}
    </div>
  );
}

export function HomeTodayCard({ word, puzzles, unlimited, wordPlayed, puzzlesPlayed, next, onOpen }: {
  word: GroupProgress;
  puzzles: GroupProgress;
  unlimited: boolean;
  /** Unlimited mode: games played today per row. */
  wordPlayed: number;
  puzzlesPlayed: number;
  /** The next unplayed daily, if any. */
  next?: HomeCard;
  onOpen: (card: HomeCard) => void;
}) {
  return (
    <section aria-label="Today's progress" className="relative overflow-hidden h-full flex flex-col" style={softCard(BRAND_ACCENT, { radius: 22 })}>
      <div aria-hidden="true" style={{ height: 10, flex: 'none', background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
      <div className="flex-1 flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 text-[12px] font-black uppercase" style={{ letterSpacing: '0.14em', color: SOFT_INK.title }}>
            {unlimited ? 'Unlimited today' : 'Today'}
          </h2>
          {/* BJ6: the streak lives in the header's flame counter (one of each thing on Home). */}
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <ProgressTile label="Dailies" accent={DAILIES_ACCENT} progress={word} unlimited={unlimited} unlimitedPlayed={wordPlayed} />
          <ProgressTile label="Puzzles" accent={PUZZLES_ACCENT} progress={puzzles} unlimited={unlimited} unlimitedPlayed={puzzlesPlayed} />
        </div>
        {/* BJ6 (one of each thing on Home): the reset countdown lives in the banner's meta line and
            the share button in the app header, so this card keeps only the next daily to play. */}
        {next ? (
          <div className="mt-auto flex justify-end">
            <CastButton size="md" color="purple" icon="play" onClick={() => onOpen(next)} className="shrink-0" style={{ maxWidth: '62%' }}>
              {next.title}
            </CastButton>
          </div>
        ) : null}
      </div>
    </section>
  );
}
