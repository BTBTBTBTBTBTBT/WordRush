// Seasonal mascot-maker items (founder 10-05: "some seasonal mascot options too, available should any user want to
// make their mascot fit the season"). A part is seasonal when its avatar-parts.json item carries `season`
// (= a season-registry / SEASON_WINDOWS id); the art ships with docs/design/brand/avatar/integration/ship-seasonal.py.
// Adding a season's items is ART + DATA: no code here changes. Pinned ×3 by avatar-season-fixtures.json
// (Swift AvatarSeason.swift, Kotlin AvatarSeason.kt).
//
// Rules (product call 10-05; the founder can change them):
//   - Free for everyone while the season is on (its window, or the admin Season preview).
//   - A seasonal part the player SAVED stays on their mascot and in its tab after the season (never strip a look).
//   - Out of season, unsaved seasonal parts are hidden (they come back next year). Randomize never picks them.
//   - One Home nudge per season per year ("Dress up for Halloween?"), only for players not already wearing one.

import { AVATAR_HEADS, AVATAR_INTEGRATED_OPTIONS, AVATAR_NECKS, AVATAR_FACES, type AvatarConfig } from './avatar-config';
import { AVATAR_MANIFEST, avatarItemKey, type AvatarManifest, type AvatarPartField } from './avatar-layout';
import { currentSeason } from './level-season';

/** A config field + part id (e.g. head + pumpkinhat). */
export interface AvatarPart { field: string; id: string }

/** The maker fields that can hold a seasonal part, in shelf order (hats first, the buddy last). */
export const AVATAR_SEASONAL_FIELDS = ['head', 'neck', 'wrap', 'held', 'face', 'feet', 'pet', 'extra'] as const;

function options(field: string): readonly string[] {
  if (field === 'head') return AVATAR_HEADS;
  if (field === 'neck') return AVATAR_NECKS;
  if (field === 'face') return AVATAR_FACES;
  return (AVATAR_INTEGRATED_OPTIONS as Record<string, readonly string[]>)[field] ?? [];
}

/** The season a part belongs to (avatar-parts.json `season`), or null for an everyday part. */
export function avatarPartSeason(field: string, id: string, manifest: AvatarManifest = AVATAR_MANIFEST): string | null {
  if (!id || id === 'none') return null;
  if (field === 'body') return manifest.bodies[id]?.season ?? null;
  const item = manifest.items[avatarItemKey(field as AvatarPartField, id)] as { season?: string } | undefined;
  return item?.season ?? null;
}

/**
 * The season the maker dresses for: the admin preview when one is set ('none' = the preview forces no season),
 * else the calendar's (null outside every window).
 */
export function mascotSeason(date: string | Date, previewSeason: string | null | undefined): string | null {
  if (previewSeason === 'none') return null;
  if (previewSeason) return previewSeason;
  return currentSeason(date);
}

/**
 * May the maker show (and Randomize pick) this part? Everyday parts: always. A seasonal part: while its season is
 * on (window or preview), or when the player's SAVED config wears it (a saved look is never stripped).
 */
export function isPartAvailable(
  part: AvatarPart,
  date: string | Date,
  previewSeason: string | null | undefined,
  savedConfig: object | null | undefined,
  manifest: AvatarManifest = AVATAR_MANIFEST,
): boolean {
  const season = avatarPartSeason(part.field, part.id, manifest);
  if (!season) return true;
  if (savedConfig && (savedConfig as Record<string, unknown>)[part.field] === part.id) return true;
  return mascotSeason(date, previewSeason) === season;
}

/** The season's shelf: every part of `season`, hats first, each field in its catalog order. */
export function seasonalShelf(season: string | null, manifest: AvatarManifest = AVATAR_MANIFEST): AvatarPart[] {
  if (!season) return [];
  const out: AvatarPart[] = [];
  for (const field of AVATAR_SEASONAL_FIELDS) {
    for (const id of options(field)) if (avatarPartSeason(field, id, manifest) === season) out.push({ field, id });
  }
  return out;
}

/** Does the config wear any seasonal part (of `season`, or of any season when null)? */
export function wearsSeasonalPart(config: Partial<AvatarConfig> | null | undefined, season: string | null = null, manifest: AvatarManifest = AVATAR_MANIFEST): boolean {
  if (!config) return false;
  for (const field of AVATAR_SEASONAL_FIELDS) {
    const id = (config as Record<string, unknown>)[field];
    if (typeof id !== 'string') continue;
    const s = avatarPartSeason(field, id, manifest);
    if (s && (season === null || s === season)) return true;
  }
  return false;
}

/** The nudge's "seen" key: one per season per year (it comes back next year). */
export function seasonNudgeKey(season: string, date: string | Date): string {
  const year = typeof date === 'string' ? Number(date.slice(0, 4)) : date.getFullYear();
  return `${season}-${year}`;
}

/**
 * The one-time Home nudge ("Dress up for Halloween?"): the season is on, it has a shelf, the player hasn't
 * dismissed / answered it this season, and isn't already wearing one of its parts.
 */
export function seasonNudgeDue(
  date: string | Date,
  previewSeason: string | null | undefined,
  config: Partial<AvatarConfig> | null | undefined,
  seenKeys: readonly string[],
  manifest: AvatarManifest = AVATAR_MANIFEST,
): string | null {
  const season = mascotSeason(date, previewSeason);
  if (!season || seasonalShelf(season, manifest).length === 0) return null;
  if (seenKeys.includes(seasonNudgeKey(season, date))) return null;
  if (wearsSeasonalPart(config, season, manifest)) return null;
  return season;
}

/** The small tag on a seasonal tile (the season id upper-cased: HALLOWEEN, THANKSGIVING, WINTER HOLIDAYS). */
export function seasonTag(season: string): string {
  return season.replace(/-/g, ' ').toUpperCase();
}
