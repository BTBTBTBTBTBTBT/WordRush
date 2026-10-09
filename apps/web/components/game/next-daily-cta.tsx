'use client';

import { Icon3D } from '@/components/ui/icon3d';
import { CandyLink } from '@/components/ui/candy-button';
import { CastLink } from '@/components/ui/cast-button';
import { useDailyCompletions } from '@/lib/daily-completions-context';
import { PROFILE_MODES } from '@/components/profile/mode-picker';
import { SWEEP_MODES } from '@/lib/modes.generated';
import { dailyHref } from '@/lib/mode-routes';
import { ArtScene } from '@/components/ui/art-scene';
import { PAGE_SCENES } from '@/lib/art';
import { accentInk, softCard } from '@/lib/soft-surface';
import { UnlimitedCard } from './finished-kit';
import { useCelebrationPending } from '@/lib/use-celebration-pending';
import { shouldDeferHandoff } from '@/lib/celebration-gate';
import { nextUnplayed, sortByOrder } from '@wordle-duel/core';
import { useGameOrder, resolvedOrder } from '@/lib/game-order-store';

// Canonical daily order + routes = the catalog's sweep set (More Games Stage
// 4: no second hand-typed list). First unplayed sweep mode in this order is
// "next"; More Games titles never appear here because they are not in the sweep.
const DAILY_ORDER: Array<{ id: string; href: string }> = SWEEP_MODES
  .map((m) => ({ id: m.dbKey as string, href: dailyHref(m.dbKey as string) ?? '/' }));

/** The CTA stack's row: full width up to 400, 10 px apart (B6). */
const CTA_ROW = 'w-full max-w-[400px] mx-auto mt-3';
/** The sweep-done strip's ink: deep amber on light, a light amber on the dark card. */
const SWEEP_INK = accentInk('#f5a524', '#92400e');

/**
 * U3: post-game handoff that keeps the daily loop moving. FINISH_SPEC B6 + A8:
 * the three CTAs are glossy candy buttons with icons — amber next daily,
 * purple leaderboard, soft peach Unlimited. Rendered only on
 * DAILY results — points at the first unplayed daily mode, or celebrates
 * the sweep when every sweep mode is done. `currentMode` is excluded explicitly so a
 * just-finished game never suggests itself while its completion event is
 * still propagating into the completions context.
 */
export function NextDailyCta({ currentMode }: { currentMode: string }) {
  const { todayDailies } = useDailyCompletions();
  // 2.8 item 52: while a Flawless / Sweep celebration is due, every handoff goes Home first (it plays there).
  const homeFirst = shouldDeferHandoff(useCelebrationPending());

  // Item 35: NEXT = the next unplayed daily in the PLAYER'S order (default: the catalog's), wrapping.
  const { order } = useGameOrder();
  const ordered = sortByOrder(SWEEP_MODES, (m) => m.id, resolvedOrder('dailies', order));
  const current = SWEEP_MODES.find((m) => m.dbKey === currentMode);
  const played = new Set(SWEEP_MODES.filter((m) => todayDailies.has(m.dbKey as string)).map((m) => m.id));
  const nextId = current ? nextUnplayed(ordered.map((m) => m.id), current.id, played) : null;
  const nextMode = nextId ? SWEEP_MODES.find((m) => m.id === nextId) : ordered.find((m) => !played.has(m.id));
  const next = nextMode ? DAILY_ORDER.find((m) => m.id === nextMode.dbKey) : undefined;

  return (
    <>
      {next ? <NextDailyLink next={next} homeFirst={homeFirst} /> : (
        <div
          className={`${CTA_ROW} px-3 py-2.5 flex items-center justify-center gap-2 text-xs font-black ${SWEEP_INK.className}`}
          style={{ ...softCard('#f5a524', { radius: 16 }), ...SWEEP_INK.style }}
        >
          {/* U, all done for today (docs/ART_SPEC.md §7), small enough for the strip. */}
          <ArtScene scene={PAGE_SCENES.allDone} height={48} maxWidthPct={30} center={false} />
          All {SWEEP_MODES.length} dailies done — Sweep complete! <Icon3D name="trophy" size={18} />
        </div>
      )}
      <ViewLeaderboardLink currentMode={currentMode} homeFirst={homeFirst} />
      <KeepPlayingUnlimited currentMode={currentMode} />
    </>
  );
}

/**
 * §214 (Lindsay): straight from the finish line to the scoreboard — a
 * clean row linking the just-played mode's daily leaderboard.
 */
function ViewLeaderboardLink({ currentMode, homeFirst }: { currentMode: string; homeFirst: boolean }) {
  const mode = PROFILE_MODES.find((m) => m.dbKey === currentMode);
  if (!mode) return null;

  return (
    <div className={CTA_ROW}>
      <CastLink href={homeFirst ? '/' : `/daily?mode=${currentMode}`} color="purple" size="lg" block icon={<Icon3D name="trophy" size={26} />} aria-label={`View ${mode.title} Leaderboard`}>
        {mode.title} Leaderboard
      </CastLink>
    </div>
  );
}

function NextDailyLink({ next, homeFirst }: { next: { id: string; href: string }; homeFirst: boolean }) {
  const mode = PROFILE_MODES.find((m) => m.dbKey === next.id);
  if (!mode) return null;

  return (
    <div className={CTA_ROW}>
      <CastLink href={homeFirst ? '/' : next.href} color="amber" size="lg" block icon="arrow" aria-label={`Next Daily: ${mode.title}`}>
        Next daily: {mode.title}
      </CastLink>
    </div>
  );
}

/**
 * "Keep playing: Unlimited <Mode>" — Pro-only handoff into an Unlimited game
 * of the SAME mode (tester-reported dead end after the daily). FINISH_SPEC R3:
 * now the peach KEEP PLAYING card with the U loop art (finished-kit.tsx
 * UnlimitedCard): Pro gets a full document load into the same route without
 * ?daily; free players and guests see the same card (gold PRO pill) and tapping
 * it opens the Go Pro popup (founder 10-02).
 */
function KeepPlayingUnlimited({ currentMode }: { currentMode: string }) {
  return <UnlimitedCard currentMode={currentMode} className="mt-3" />;
}
