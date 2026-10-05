/**
 * admin > Content & Ops > Art Library: the pure logic behind the page (filters,
 * facet counts, sorting, the costume-vs-hero pairing, the Founder picks grouping)
 * plus the request validation the /api/admin/art routes share. No React, no
 * Supabase: the page and the routes both import from here and the tests pin it.
 */

export type ArtStage = 'final' | 'working';

export const ART_STATUSES = ['draft', 'approved', 'rejected', 'shipped'] as const;
export type ArtStatus = (typeof ART_STATUSES)[number];

/** One row of public.art_assets (one file in the private 'art-library' bucket). */
export interface ArtAsset {
  /** Repo path without extension, e.g. 'seasons/halloween/cast/w-alt1'. */
  id: string;
  /** Repo-relative path with extension; also the object key in the bucket. */
  path: string;
  type: string;
  kind: string | null;
  season: string | null;
  character: string | null;
  status: ArtStatus;
  /** final = the art itself; working = what it is made from (rig parts, raw, keyed copies, pieces, retired). */
  stage: ArtStage;
  title: string;
  caption: string | null;
  width: number | null;
  height: number | null;
  mime: string;
  bytes: number;
  sha256: string | null;
  created_at: string;
  updated_at: string;
  decided_by: string | null;
  decided_at: string | null;
  note: string | null;
}

export type ArtFacet = 'type' | 'season' | 'character' | 'status';
export const ART_FACETS: readonly ArtFacet[] = ['type', 'season', 'character', 'status'];

export interface ArtFilters {
  type: string | null;
  season: string | null;
  character: string | null;
  status: ArtStatus | null;
  /** Free-text search over title, caption, path and id. */
  q: string;
  /** Show working files too (off by default: the library opens on finished art). */
  working: boolean;
}

export const EMPTY_FILTERS: ArtFilters = { type: null, season: null, character: null, status: null, q: '', working: false };

/** featured (default): season art awaiting a call, then the newest finished pieces. */
export type ArtSort = 'featured' | 'newest' | 'az';

export type ArtMedia = 'image' | 'html' | 'audio' | 'other';

export const SIGN_VARIANTS = ['thumb', 'full', 'download'] as const;
export type SignVariant = (typeof SIGN_VARIANTS)[number];
export const SIGN_MAX_IDS = 120;

/** What a tile or the lightbox should render for a mime type. */
export function mediaOf(mime: string): ArtMedia {
  if (/^image\//.test(mime)) return 'image';
  if (mime === 'text/html') return 'html';
  if (/^audio\//.test(mime)) return 'audio';
  return 'other';
}

/** Raster images the storage image transformer can thumbnail. */
export function isRaster(mime: string): boolean {
  return mime === 'image/png' || mime === 'image/webp' || mime === 'image/jpeg' || mime === 'image/jpg';
}

export function isArtStatus(s: unknown): s is ArtStatus {
  return typeof s === 'string' && (ART_STATUSES as readonly string[]).includes(s);
}

/** The value an asset carries for a facet (null = not set). */
export function facetValue(a: ArtAsset, facet: ArtFacet): string | null {
  return a[facet] ?? null;
}

function matchesQuery(a: ArtAsset, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return [a.title, a.caption, a.path, a.id].some((s) => !!s && s.toLowerCase().includes(needle));
}

/** True when `a` passes every active filter except `skip` (for facet counts). */
function passes(a: ArtAsset, f: ArtFilters, skip?: ArtFacet): boolean {
  if (!f.working && a.stage === 'working') return false;
  for (const facet of ART_FACETS) {
    if (facet === skip) continue;
    const want = f[facet];
    if (want != null && facetValue(a, facet) !== want) return false;
  }
  return matchesQuery(a, f.q);
}

export function filterAssets(assets: readonly ArtAsset[], f: ArtFilters): ArtAsset[] {
  return assets.filter((a) => passes(a, f));
}

export interface FacetCount { value: string; count: number }

/**
 * Chip counts for one facet, computed against the OTHER active filters (and the
 * search), so picking a season still shows how many of each type it holds. Values
 * with zero matches are dropped unless currently selected; status keeps its
 * fixed order, everything else sorts by count then name.
 */
export function facetCounts(assets: readonly ArtAsset[], f: ArtFilters, facet: ArtFacet): FacetCount[] {
  const counts = new Map<string, number>();
  for (const a of assets) {
    if (!passes(a, f, facet)) continue;
    const v = facetValue(a, facet);
    if (v == null) continue;
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  const selected = f[facet];
  if (selected != null && !counts.has(selected)) counts.set(selected, 0);
  const rows = Array.from(counts, ([value, count]) => ({ value, count }));
  if (facet === 'status') {
    return rows.sort((a, b) => ART_STATUSES.indexOf(a.value as ArtStatus) - ART_STATUSES.indexOf(b.value as ArtStatus));
  }
  return rows.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** Newest first (created_at desc, then id), or A to Z by title (then id). */
/** 1 for working pieces (rig layers, raw captures, explorations), else 0. */
const WORK_KINDS = new Set(['layers', 'raw', 'rig', 'explorations', 'options']);
function workRank(a: Pick<ArtAsset, 'kind' | 'stage'>): number {
  return a.stage === 'working' || (a.kind && WORK_KINDS.has(a.kind)) ? 1 : 0;
}

/** Seasons in calendar order from the fall (the next one up first); unknown seasons after. */
const SEASON_ORDER = ['halloween', 'thanksgiving', 'winter-holidays', 'new-year', 'valentines', 'st-patricks', 'spring-easter', 'fourth-of-july', 'back-to-school'];
function seasonRank(a: Pick<ArtAsset, 'season'>): number {
  const i = a.season ? SEASON_ORDER.indexOf(a.season) : -1;
  return i < 0 ? SEASON_ORDER.length : i;
}

/** Featured order: approved season art, then draft season art (the founder's open calls), then the rest. */
function featuredRank(a: Pick<ArtAsset, 'season' | 'status'>): number {
  if (!a.season) return 2;
  return a.status === 'approved' ? 0 : a.status === 'draft' ? 1 : 2;
}

export function sortAssets(assets: readonly ArtAsset[], sort: ArtSort): ArtAsset[] {
  const out = assets.slice();
  if (sort === 'featured') {
    out.sort((a, b) => featuredRank(a) - featuredRank(b) || seasonRank(a) - seasonRank(b) || workRank(a) - workRank(b)
      || (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : a.id.localeCompare(b.id)));
  } else if (sort === 'az') {
    out.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }) || a.id.localeCompare(b.id));
  } else {
    // Same day: finished art first (working pieces like rig layers and raw captures last), then by path.
    out.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1
      : workRank(a) - workRank(b) || a.id.localeCompare(b.id)));
  }
  return out;
}

/** The plain hero a seasonal costume is compared against, or null for non-costumes. */
export function heroIdFor(a: Pick<ArtAsset, 'season' | 'character'>): string | null {
  return a.season && a.character ? `characters/hero/${a.character}` : null;
}

export interface FounderPickGroup { type: string; assets: ArtAsset[] }

/**
 * Founder picks: approved but not yet shipped = the to-do list for wiring art
 * into the apps. Grouped by type (biggest group first), most recent decision
 * first within a group.
 */
export function groupFounderPicks(assets: readonly ArtAsset[]): FounderPickGroup[] {
  const byType = new Map<string, ArtAsset[]>();
  for (const a of assets) {
    if (a.status !== 'approved') continue;
    const list = byType.get(a.type) ?? [];
    list.push(a);
    byType.set(a.type, list);
  }
  const when = (a: ArtAsset) => a.decided_at ?? a.updated_at ?? a.created_at;
  return Array.from(byType, ([type, list]) => ({
    type,
    assets: list.sort((a, b) => (when(a) < when(b) ? 1 : when(a) > when(b) ? -1 : a.id.localeCompare(b.id))),
  })).sort((a, b) => b.assets.length - a.assets.length || a.type.localeCompare(b.type));
}

/** File name for a download: the last path segment. */
export function basename(path: string): string {
  const i = path.lastIndexOf('/');
  return i >= 0 ? path.slice(i + 1) : path;
}

/** "12 KB" / "1.4 MB". */
export function formatBytes(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Human label for a facet value: 'winter-holidays' -> 'Winter holidays', cast ids upper-cased. */
export function facetLabel(facet: ArtFacet, value: string): string {
  if (facet === 'character') return value.toUpperCase();
  const s = value.replace(/[-_]+/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Validate a POST /api/admin/art/sign body. */
export function parseSignBody(body: unknown): { ids: string[]; variant: SignVariant } | { error: string } {
  const b = (body ?? {}) as { ids?: unknown; variant?: unknown };
  if (!Array.isArray(b.ids) || !b.ids.every((x) => typeof x === 'string')) return { error: 'ids must be an array of strings' };
  if (b.ids.length > SIGN_MAX_IDS) return { error: `at most ${SIGN_MAX_IDS} ids per request` };
  if (typeof b.variant !== 'string' || !(SIGN_VARIANTS as readonly string[]).includes(b.variant)) {
    return { error: "variant must be 'thumb', 'full' or 'download'" };
  }
  return { ids: Array.from(new Set(b.ids as string[])), variant: b.variant as SignVariant };
}

/** Validate a POST /api/admin/art/decide body. */
export function parseDecideBody(body: unknown): { id: string; status: ArtStatus; note: string | null | undefined } | { error: string } {
  const b = (body ?? {}) as { id?: unknown; status?: unknown; note?: unknown };
  if (typeof b.id !== 'string' || !b.id.trim()) return { error: 'id is required' };
  if (!isArtStatus(b.status)) return { error: "status must be 'approved', 'rejected', 'draft' or 'shipped'" };
  if (b.note !== undefined && b.note !== null && typeof b.note !== 'string') return { error: 'note must be a string' };
  const note = typeof b.note === 'string' ? (b.note.trim() ? b.note.trim().slice(0, 2000) : null) : (b.note as null | undefined);
  return { id: b.id, status: b.status, note };
}
