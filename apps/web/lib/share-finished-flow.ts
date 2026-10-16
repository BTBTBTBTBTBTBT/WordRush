// One entry point for the six word-game Share buttons (Classic / Six / Seven, QuadWord, OctoWord, Deliverance,
// Succession, ProperNoundle). Flag share_sheet_v2 ON: open the custom share sheet (components/share/share-sheet.tsx).
// OFF: the old flow, the "No spoilers / Full results" chooser and then shareResult. Games call this and only need to
// say how to build the card for a variant.

import type { ShareImageInput, ShareMode } from './share-image';
import { finishedSheetContext, lookToSeason } from './share-sheet-web';
import { activeSeason } from './season';
import { getTodayLocal } from './daily-service';
import { shareResult } from './share-utils';

export interface FinishedShareOpts {
  /** share_sheet_v2 resolved for this viewer (useFlags + shareSheetEnabled). */
  sheet: boolean;
  /** The catalog mode id ('quordle', 'classic', …): picks the toggle copy and rides the tracked link. */
  catalogMode: string;
  gameName: ShareMode;
  isDaily: boolean;
  won: boolean;
  multi: boolean;
  guesses: number;
  /** Seconds. */
  timeSeconds: number;
  boardsTotal?: number;
  /** Builds the card input for the chosen spoiler variant (`reveal` = Full results). */
  build: (reveal: boolean) => ShareImageInput;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/** Resolves true when the legacy path shared (the caller flashes its "Copied" state); the sheet has its own toasts. */
export async function shareFinished(o: FinishedShareOpts): Promise<boolean> {
  if (o.sheet) {
    const { openShareSheet } = await import('@/components/share/share-sheet');
    const { generateShareImage } = await import('./share-image');
    openShareSheet({
      fileMode: o.gameName,
      ctx: finishedSheetContext({
        catalogMode: o.catalogMode,
        gameName: o.gameName,
        isDaily: o.isDaily,
        won: o.won,
        multi: o.multi,
        guesses: o.guesses,
        time: clock(o.timeSeconds),
        boardsTotal: o.boardsTotal,
        date: getTodayLocal(),
        season: activeSeason(),
      }),
      render: (_card, variant, look) => generateShareImage(o.build(variant === 'full'), { season: lookToSeason(look) }),
    });
    return false;
  }
  const { chooseShareVariant } = await import('@/components/share/share-variant-modal');
  const variant = await chooseShareVariant();
  if (!variant) return false;
  const out = await shareResult(o.build(variant === 'full'));
  return out.via !== 'failed';
}
