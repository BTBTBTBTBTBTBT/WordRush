/**
 * admin > Art Library: the sectioned view. The library is shown as SECTIONS, grouped by area (a season,
 * else the asset type) then sub-type (the kind): "Halloween · Costumes", "Mascot maker · New items",
 * "Buttons · Family", "Widgets". Sections that still need the viewer's review open first (the next season
 * up first); finished ones sit collapsed below, and shipped pieces sit last inside a section. Also the "Approve all" plan for a section and the
 * optimistic review update the page applies before the server answers. Pure (no React, no fetch).
 */
import { facetLabel, type ArtAsset } from './art-library';
import {
  pendingReviewers, reviewStatus, type ArtReview, type ArtReviewer, type ReviewContext, type ReviewDecision,
} from './art-review';

/** The top switch: Needs my review / All / Approved / Rejected. */
export const REVIEW_TABS = ['mine', 'all', 'approved', 'rejected'] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];

export interface SectionCounts {
  total: number;
  /** Waiting on the viewer (a reviewer), or on anyone (a viewer who does not review). */
  toReview: number;
  /** Approved by every reviewer, or shipped. */
  approved: number;
  rejected: number;
  shipped: number;
  /** The viewer's own reject / changes calls in this section. */
  flaggedByMe: number;
}

export interface ArtSection {
  /** `${area}/${sub ?? ''}` */
  key: string;
  area: string;
  sub: string | null;
  /** "Halloween · Costumes" (or just "Widgets" when there is no sub-type). */
  label: string;
  season: string | null;
  assets: ArtAsset[];
  counts: SectionCounts;
  /** Nothing left for the viewer to review: shown collapsed by default. */
  done: boolean;
}

const AREA_LABEL: Record<string, string> = { 'mascot-maker': 'Mascot maker', ui: 'UI', 'winter-holidays': 'Winter holidays', 'st-patricks': "St. Patrick's", 'fourth-of-july': 'Fourth of July' };
const SUB_LABEL: Record<string, string> = {
  cast: 'Costumes', titles: 'Titles', header: 'Header cuts', props: 'Props', extras: 'Extras', walls: 'Wallpapers',
  pieces: 'Pieces', raw: 'Raw captures', new: 'New items', parts: 'Parts', bodies: 'Bodies', integration: 'Integration',
  family: 'Family', skins: 'Skins', labels: 'Labels', options: 'Options', layers: 'Rig layers', player: 'Players',
  menus: 'Menus', game: 'Game titles', pages: 'Page titles', days: 'Day titles', moments: 'Moments', cameos: 'Cameos',
  'cast-colors': 'Cast colors', inventory: 'Inventory', pocket: 'Pocket games', achievements: 'Achievements',
  refs: 'References', poses: 'Poses', hero: 'Heroes', app: 'App art', explorations: 'Explorations', retired: 'Retired',
  '65': '6.5-inch shots', '67': '6.7-inch shots', 'x-twitter': 'X', 'gopro-sign': 'GoPro sign', glyphs: 'Glyphs',
  frames: 'Frames', toggles: 'Toggles', medals: 'Medals', react: 'Reactions', games: 'Game icons', sprites: 'Sprites',
  wide: 'Wide', out: 'Cut-outs', upload: 'Uploads', backgrounds: 'Backgrounds', gauntlet: 'Gauntlet', layouts: 'Layouts',
  mockups: 'Mockups', 'profile-pictures': 'Profile pictures', linkedin: 'LinkedIn', tiktok: 'TikTok', youtube: 'YouTube',
};

/** Seasons in the sub order a reviewer reads them: the cast first, raw captures last. */
const SUB_ORDER = ['cast', 'new', 'family', 'titles', 'header', 'props', 'extras', 'walls', 'skins', 'labels', 'parts', 'menus', 'game', 'pages', 'pieces', 'raw'];
/** Non-season areas, most-reviewed first; unknown areas after, A to Z. */
const AREA_ORDER = ['mascot-maker', 'buttons', 'titles', 'widgets', 'wallpapers', 'icons', 'podium', 'scenes', 'ui', 'logo', 'characters', 'animation', 'sounds', 'social', 'store', 'badges'];
/** Each season's day (month, day), for "the next season up first". */
const SEASON_DAY: Record<string, [number, number]> = {
  halloween: [10, 31], thanksgiving: [11, 26], 'winter-holidays': [12, 25], 'new-year': [1, 1], valentines: [2, 14],
  'st-patricks': [3, 17], 'spring-easter': [4, 5], 'fourth-of-july': [7, 4], 'back-to-school': [8, 20],
};

/** A batch-dated kind ('2026-10-02') is not a sub-type: it folds into the area. */
const subOf = (a: Pick<ArtAsset, 'kind'>): string | null => (a.kind && !/^\d{4}-\d{2}-\d{2}$/.test(a.kind) ? a.kind : null);
const areaOf = (a: Pick<ArtAsset, 'season' | 'type'>): string => a.season ?? a.type;

export function sectionKeyOf(a: Pick<ArtAsset, 'season' | 'type' | 'kind'>): string {
  return `${areaOf(a)}/${subOf(a) ?? ''}`;
}

export function areaLabel(area: string): string {
  return AREA_LABEL[area] ?? facetLabel('season', area);
}

export function sectionLabel(area: string, sub: string | null): string {
  if (!sub) return areaLabel(area);
  return `${areaLabel(area)} · ${SUB_LABEL[sub] ?? facetLabel('type', sub)}`;
}

/** Days from `now` until the season's next day (0 on the day itself); unknown seasons sort last. */
export function daysUntilSeason(season: string, now: Date): number {
  const d = SEASON_DAY[season];
  if (!d) return 9999;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  let next = Date.UTC(now.getFullYear(), d[0] - 1, d[1]);
  if (next < today) next = Date.UTC(now.getFullYear() + 1, d[0] - 1, d[1]);
  return Math.round((next - today) / 86_400_000);
}

const iReview = (ctx: ReviewContext) => !!ctx.me && ctx.reviewers.some((r) => r.profile_id === ctx.me);

/** Waiting on the viewer (when they review), else waiting on anyone. */
export function needsReview(a: Pick<ArtAsset, 'id' | 'status'>, ctx: ReviewContext): boolean {
  const pending = pendingReviewers(a, ctx.index, ctx.reviewers);
  return iReview(ctx) ? pending.includes(ctx.me!) : pending.length > 0;
}

/** Does the asset belong under this tab of the top switch? */
export function matchesTab(a: Pick<ArtAsset, 'id' | 'status'>, tab: ReviewTab, ctx: ReviewContext): boolean {
  if (tab === 'all') return true;
  if (tab === 'mine') return needsReview(a, ctx);
  if (tab === 'approved') return a.status === 'approved' || a.status === 'shipped';
  return a.status === 'rejected';
}

export function sectionCounts(assets: ReadonlyArray<Pick<ArtAsset, 'id' | 'status'>>, ctx: ReviewContext): SectionCounts {
  const out: SectionCounts = { total: assets.length, toReview: 0, approved: 0, rejected: 0, shipped: 0, flaggedByMe: 0 };
  for (const a of assets) {
    if (needsReview(a, ctx)) out.toReview += 1;
    if (a.status === 'approved' || a.status === 'shipped') out.approved += 1;
    if (a.status === 'shipped') out.shipped += 1;
    if (a.status === 'rejected') out.rejected += 1;
    const mine = ctx.me ? ctx.index.get(a.id)?.get(ctx.me)?.decision : undefined;
    if (mine === 'reject' || mine === 'changes') out.flaggedByMe += 1;
  }
  return out;
}

/**
 * Group assets into sections. Open sections (something left for the viewer) first, then finished ones;
 * within each band season sections by the next season up, then the other areas in AREA_ORDER, and
 * sub-types in SUB_ORDER. Assets keep their incoming order inside a section.
 */
export function groupSections(assets: readonly ArtAsset[], ctx: ReviewContext, now: Date = new Date()): ArtSection[] {
  const byKey = new Map<string, ArtAsset[]>();
  for (const a of assets) {
    const k = sectionKeyOf(a);
    const list = byKey.get(k);
    if (list) list.push(a);
    else byKey.set(k, [a]);
  }
  // Inside a section, shipped pieces go last (status a review never changes, so tiles never jump on a tap).
  for (const list of Array.from(byKey.values())) list.sort((a, b) => Number(a.status === 'shipped') - Number(b.status === 'shipped'));
  const sections: ArtSection[] = Array.from(byKey, ([key, list]) => {
    const first = list[0];
    const area = areaOf(first);
    const sub = subOf(first);
    const counts = sectionCounts(list, ctx);
    return { key, area, sub, label: sectionLabel(area, sub), season: first.season, assets: list, counts, done: counts.toReview === 0 };
  });
  const areaRank = (s: ArtSection) => {
    if (s.season) return daysUntilSeason(s.season, now);
    const i = AREA_ORDER.indexOf(s.area);
    return 10_000 + (i < 0 ? AREA_ORDER.length : i);
  };
  const subRank = (s: ArtSection) => {
    const i = s.sub ? SUB_ORDER.indexOf(s.sub) : -1;
    return s.sub == null ? -1 : i < 0 ? SUB_ORDER.length : i;
  };
  return sections.sort((a, b) => Number(a.done) - Number(b.done)
    || areaRank(a) - areaRank(b)
    || a.area.localeCompare(b.area)
    || subRank(a) - subRank(b)
    || (a.sub ?? '').localeCompare(b.sub ?? ''));
}

/** "Approve all" for the viewer: every piece they have not called yet (shipped art skipped); their flags stay. */
export function approveAllPlan(assets: ReadonlyArray<Pick<ArtAsset, 'id' | 'status'>>, ctx: ReviewContext): { ids: string[]; flagged: number } {
  if (!iReview(ctx)) return { ids: [], flagged: 0 };
  const ids: string[] = [];
  let flagged = 0;
  for (const a of assets) {
    const mine = ctx.index.get(a.id)?.get(ctx.me!)?.decision;
    if (mine === 'reject' || mine === 'changes') flagged += 1;
    else if (!mine && a.status !== 'shipped') ids.push(a.id);
  }
  return { ids, flagged };
}

/** The line a collapsed section shows: "Approved by both", "All approved by you · waiting on JP" ... */
export function sectionSummary(s: Pick<ArtSection, 'assets' | 'counts'>, ctx: ReviewContext): string {
  const { counts } = s;
  if (counts.total > 0 && counts.shipped === counts.total) return 'All shipped';
  const both = ctx.reviewers.length === 2 ? 'both' : 'all';
  if (counts.total > 0 && counts.approved === counts.total) return `Approved by ${both}`;
  const waitingOn = ctx.reviewers.filter((r) => r.profile_id !== ctx.me
    && s.assets.some((a) => pendingReviewers(a, ctx.index, ctx.reviewers).includes(r.profile_id)));
  const waiting = waitingOn.length ? ` · waiting on ${waitingOn.map((r) => r.short_name).join(' and ')}` : '';
  if (iReview(ctx) && counts.toReview === 0) {
    const flagged = counts.flaggedByMe ? `${counts.flaggedByMe} flagged by you` : 'All approved by you';
    return `${flagged}${waiting}`;
  }
  if (counts.toReview > 0) return `${counts.toReview} to review${waiting}`;
  return counts.rejected ? `${counts.rejected} rejected${waiting}` : `Reviewed${waiting}`;
}

/**
 * The optimistic version of a review landing: the viewer's rows for `ids` replaced by `decision`, and each
 * asset's status recomputed with the same rule the server uses (shipped is left alone).
 */
export function applyReviews(
  assets: readonly ArtAsset[],
  reviews: readonly ArtReview[],
  ids: readonly string[],
  me: string,
  decision: ReviewDecision,
  note: string | null,
  reviewers: readonly Pick<ArtReviewer, 'profile_id'>[],
  nowIso: string = new Date().toISOString(),
): { assets: ArtAsset[]; reviews: ArtReview[] } {
  const want = new Set(ids);
  const prior = new Map(reviews.filter((r) => r.reviewer_id === me && want.has(r.asset_id)).map((r) => [r.asset_id, r]));
  const nextReviews = reviews.filter((r) => !(r.reviewer_id === me && want.has(r.asset_id)));
  for (const id of ids) {
    nextReviews.push({ asset_id: id, reviewer_id: me, decision, note, created_at: prior.get(id)?.created_at ?? nowIso, updated_at: nowIso });
  }
  const reviewerIds = reviewers.map((r) => r.profile_id);
  const byAsset = new Map<string, ArtReview[]>();
  for (const r of nextReviews) if (want.has(r.asset_id)) byAsset.set(r.asset_id, [...(byAsset.get(r.asset_id) ?? []), r]);
  const nextAssets = assets.map((a) => {
    if (!want.has(a.id)) return a;
    const status = reviewStatus(a.status, byAsset.get(a.id) ?? [], reviewerIds);
    return status === a.status ? a : { ...a, status, decided_by: me, decided_at: nowIso, updated_at: nowIso };
  });
  return { assets: nextAssets, reviews: nextReviews };
}

