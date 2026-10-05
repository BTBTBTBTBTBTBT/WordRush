/**
 * admin > Art Library: which art is wired into the in-app season preview (Settings > Season preview > <Season>
 * on iOS and Android, ?season=<id> on the web), for every season, so the reviewers can see "this is live in the preview" and
 * leave feedback on it. The list is repo-tracked in season-preview-wired.json, no SQL:
 *
 *   { "<season>": { "<name>": { "where": "<where it shows in the app>" } } }
 *
 * <name> is either the library asset id ('seasons/halloween/titles/home'; works for every kind) or, for cast
 * skins and props, the shipped file name without its extension ('art-halloween-c', 'art-halloween-prop-bat'). A shipped file name only matches an asset whose
 * status is 'shipped' (the draft candidates seasons/halloween/cast/<id> share a would-be file name with the
 * shipped seasons/halloween/cast/night0/<id> and must not light up). Pure; tests parse the JSON.
 */
import type { ArtAsset } from './art-library';
import raw from './season-preview-wired.json';

export interface WiredEntry { where: string }
/** season -> name -> entry */
export type WiredMap = Record<string, Record<string, WiredEntry>>;
export interface WiredMatch { season: string; name: string; where: string }

/** Validate the JSON shape; throws with the offending key so a bad edit fails the tests, not the page. */
export function parseWired(input: unknown): WiredMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('season-preview-wired: expected an object of seasons');
  const out: WiredMap = {};
  for (const [season, names] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[a-z][a-z0-9-]*$/.test(season)) throw new Error(`season-preview-wired: bad season "${season}"`);
    if (!names || typeof names !== 'object' || Array.isArray(names)) throw new Error(`season-preview-wired: ${season} must be an object`);
    out[season] = {};
    for (const [name, entry] of Object.entries(names as Record<string, unknown>)) {
      const where = (entry as { where?: unknown } | null)?.where;
      if (!name.trim() || typeof where !== 'string' || !where.trim()) throw new Error(`season-preview-wired: ${season}.${name} needs a "where"`);
      out[season][name] = { where: where.trim() };
    }
  }
  return out;
}

export const SEASON_PREVIEW_WIRED: WiredMap = parseWired(raw);

const stemOf = (path: string) => path.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');

/**
 * The public file name a seasonal cast piece ships as: seasons/<s>/cast/.../props/<p> -> art-<s>-prop-<p>,
 * seasons/<s>/cast/.../<id> and seasons/<s>/header/<id> (the layered header figures, shipped as the skins since
 * 10-05) -> art-<s>-<id>. Null for everything else (header cuts, titles, walls ... are keyed
 * by their asset id: their file names are not derivable from the path).
 */
export function shippedNameOf(a: Pick<ArtAsset, 'path' | 'type' | 'kind' | 'season'>): string | null {
  if (a.type !== 'seasons' || !a.season || (a.kind !== 'cast' && a.kind !== 'header')) return null;
  const parts = a.path.split('/');
  const stem = stemOf(a.path);
  return parts[parts.length - 2] === 'props' ? `art-${a.season}-prop-${stem}` : `art-${a.season}-${stem}`;
}

/** Is this asset live in a season preview? Matches the asset id, else (shipped only) its shipped file name. */
export function wiredFor(a: Pick<ArtAsset, 'id' | 'path' | 'type' | 'kind' | 'season' | 'status'>, map: WiredMap = SEASON_PREVIEW_WIRED): WiredMatch | null {
  for (const [season, names] of Object.entries(map)) {
    const byId = names[a.id];
    if (byId) return { season, name: a.id, where: byId.where };
    if (a.status !== 'shipped' || (a.season && a.season !== season)) continue;
    const shipped = shippedNameOf(a);
    if (shipped && names[shipped]) return { season, name: shipped, where: names[shipped].where };
  }
  return null;
}

/** "Halloween", "Winter holidays" for the Settings line. */
export function seasonTitle(season: string): string {
  const s = season.replace(/-/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
