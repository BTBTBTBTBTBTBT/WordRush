import { bankRunway } from '@wordle-duel/core';
import ladder from '@/data/ladder-puzzles.json';
import wordsearch from '@/data/wordsearch-puzzles.json';
import hub from '@/data/hub-puzzles.json';
import cryptogram from '@/data/cryptogram-puzzles.json';
import groups from '@/data/groups-puzzles.json';

/**
 * Every epoch-indexed daily bank the app bundles, with its content runway
 * (More Games §11; founder, 2026-09-23: "at least a year's worth built for
 * each game and some way to notify me that we need to make more puzzles when
 * we are running low, or a method of recycling old ones").
 *
 * Three signals, all driven from this one list:
 *   - `apps/web/scripts/bank-runway.test.ts` — CI goes red under MIN_RUNWAY_DAYS
 *     and if any bank ships with fewer than TARGET_DAILIES entries;
 *   - the nightly integrity cron — a finding (red heartbeat on admin > Ops,
 *     Sentry message under SENTRY_RUNWAY_DAYS) under WARN_RUNWAY_DAYS;
 *   - admin > Ops > Content runway — every bank, days left, recycle date.
 *
 * Recycling: past its last entry a bank replays from entry 0 in order (see
 * `bankIndexForDay`), so nothing ever breaks — the founder just sees the same
 * puzzle again a full lap later. New banks register here when their game lands
 * (crossword, groups, cryptogram, scramble).
 */
export const TARGET_DAILIES = 365;
export const MIN_RUNWAY_DAYS = 60;
export const WARN_RUNWAY_DAYS = 90;
export const SENTRY_RUNWAY_DAYS = 30;

interface BundledBank { epoch: string; daily: unknown[]; extra?: unknown[] }
const BANKS: { game: string; title: string; bank: BundledBank; source: string }[] = [
  { game: 'ladder', title: 'Letter Ladder', bank: ladder as BundledBank, source: 'apps/web/scripts/ladder/build-bank.mjs' },
  { game: 'wordsearch', title: 'Spyglass', bank: wordsearch as BundledBank, source: 'apps/web/scripts/wordsearch/build-bank.mjs' },
  { game: 'hub', title: 'Hubbub', bank: hub as BundledBank, source: 'apps/web/scripts/hub/build-bank.mjs' },
  { game: 'cryptogram', title: 'Codebreaker', bank: cryptogram as unknown as BundledBank, source: 'apps/web/scripts/cryptogram/build-bank.mjs' },
  { game: 'groups', title: 'Kindred', bank: groups as unknown as BundledBank, source: 'apps/web/scripts/groups/build-bank.mjs' },
];

export interface RunwayRow {
  game: string; title: string; epoch: string; dailies: number; extras: number;
  daysLeft: number; recyclesOn: string; recycling: boolean; source: string;
  level: 'ok' | 'warn' | 'low' | 'recycling';
}

export function bankRunwayReport(day: string): RunwayRow[] {
  return BANKS.map(({ game, title, bank, source }) => {
    const r = bankRunway(day, bank.daily.length, bank.epoch);
    const level: RunwayRow['level'] = r.recycling ? 'recycling' : r.daysLeft < MIN_RUNWAY_DAYS ? 'low' : r.daysLeft < WARN_RUNWAY_DAYS ? 'warn' : 'ok';
    return { game, title, epoch: bank.epoch, dailies: bank.daily.length, extras: bank.extra?.length ?? 0, ...r, source, level };
  });
}
