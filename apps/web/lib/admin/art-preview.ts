/**
 * admin > Art Library > Preview in app: which real screen a piece belongs on and which shipped art it replaces.
 * Pure (no React, no fetch) so the mapping is pinned by tests; app/admin/art/preview/page.tsx renders the plan
 * with lib/art-override.ts swapping the candidate in.
 */
import { ART_SIZE, GAME_TITLE_ART_IDS, gameTitleArtLabel, type GameTitleArtId, type GameTitleArtName, type PageTint } from '@/lib/art';
import { CAST, type MascotId } from '@/lib/mascots';
import type { ArtAsset } from './art-library';

export type PreviewSurface = 'home' | 'game' | 'title' | 'leaderboard' | 'wallpaper' | 'buttons' | 'mascot' | 'widget' | 'none';

export const SURFACE_LABEL: Record<PreviewSurface, string> = {
  home: 'Home cast header',
  game: 'Game header',
  title: 'Page title',
  leaderboard: 'Leaderboard header',
  wallpaper: 'Page background',
  buttons: 'Buttons',
  mascot: 'Mascot builder',
  widget: 'Home-screen widget',
  none: 'No in-app preview yet',
};

/** One shipped art key the candidate stands in for (`mascot-<id>` = a hero cast member). */
export interface Swap { key: string; assetId: string; cast?: MascotId }

export interface PreviewPlan {
  surface: PreviewSurface;
  swaps: Swap[];
  /** game: which game header; title / leaderboard: the art name drawn; wallpaper: the page tint. */
  game?: GameTitleArtId;
  titleArt?: string;
  tint?: PageTint;
  /** wallpaper: the wall art name (art-wall-<tint> or art-wall-game-<id>). */
  wall?: string;
  /** buttons: the skin color and the label slug (when the piece is a label). */
  buttonColor?: string;
  label?: string;
  /** mascot: the avatar part (`eyes` + `happy`, `acc` + `crown`, `body` + `blob` …). */
  part?: { field: string; id: string };
}

const known = (name: string) => Object.prototype.hasOwnProperty.call(ART_SIZE, name);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const CAST_SET: ReadonlySet<string> = new Set(CAST);
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const TINTS: readonly PageTint[] = ['home', 'leaderboard', 'stats', 'friends', 'vs'];

/** A game id by its title as lettered on seasonal art (`classic`, `quadword`, `classicsix`) or by its id. */
export function gameIdFor(slug: string): GameTitleArtId | null {
  const n = norm(slug);
  for (const id of GAME_TITLE_ART_IDS) {
    if (id === n || norm(gameTitleArtLabel(`art-game-${id}` as GameTitleArtName)) === n) return id;
  }
  return null;
}

/** The shipped page-title art a slug stands for (`leaderboard`, `wordoftheday`, `puzzles` …), or null. */
export function titleArtFor(slug: string): string | null {
  const n = norm(slug);
  const alias: Record<string, string> = { wordoftheday: 'wotd', howtoplay: 'howto', allrecords: 'records', alltimerecords: 'records' };
  const s = alias[n] ?? n;
  for (const name of [`art-titlecast-${s}`, `art-title-${s}`, `art-titlecast-${slug}`, `art-moment-${s}`]) {
    if (known(name)) return name;
  }
  return null;
}

const stemOf = (path: string) => path.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '');

/** The preview plan for one asset (surface 'none' = show the plain image and say so). */
export function planFor(a: Pick<ArtAsset, 'id' | 'path' | 'type' | 'kind' | 'season' | 'character' | 'mime'>): PreviewPlan {
  const none: PreviewPlan = { surface: 'none', swaps: [] };
  if (!/^image\//.test(a.mime)) return none;
  const parts = a.path.split('/');
  const stem = stemOf(a.path);

  // Cast: heroes, app art, seasonal costumes (+ alts) and the seasonal header cut.
  const castId = (a.character && CAST_SET.has(a.character) ? a.character : stem.split('-')[0]) as MascotId;
  const isCast = (a.type === 'characters' && (a.kind === 'hero' || a.kind === 'app'))
    || (a.type === 'seasons' && (a.kind === 'cast' || a.kind === 'header') && parts.length === 4);
  if (isCast && CAST_SET.has(castId) && /^(o[123]|[wrdicus])(-alt\d+)?$/.test(stem)) {
    // Both the hero and the shipped Halloween skin, so the candidate shows whichever look is on.
    return { surface: 'home', swaps: [{ key: `mascot-${castId}`, assetId: a.id, cast: castId }, { key: `art-halloween-${castId}`, assetId: a.id, cast: castId }] };
  }

  // Titles.
  if (a.type === 'seasons' && a.kind === 'titles') {
    const base = stem.replace(/-alt\d+$/, '');
    if (base.startsWith('game-')) {
      const game = gameIdFor(base.slice(5));
      if (game) return { surface: 'game', game, swaps: [{ key: `art-game-${game}`, assetId: a.id }] };
    }
    const slug = base.replace(/^page-/, '');
    if (DAYS.includes(slug)) return { surface: 'leaderboard', titleArt: `art-day-${slug}`, swaps: [{ key: `art-day-${slug}`, assetId: a.id }] };
    const t = titleArtFor(slug);
    if (t) return { surface: slug === 'leaderboard' ? 'leaderboard' : 'title', titleArt: t, swaps: [{ key: t, assetId: a.id }] };
    return none;
  }
  if (a.type === 'titles') {
    if (a.kind === 'game' && parts.length === 3) {
      const game = gameIdFor(stem);
      if (game) return { surface: 'game', game, swaps: [{ key: `art-game-${game}`, assetId: a.id }] };
    }
    if (a.kind === 'days' && DAYS.includes(stem)) {
      return { surface: 'leaderboard', titleArt: `art-day-${stem}`, swaps: [{ key: `art-day-${stem}`, assetId: a.id }] };
    }
    if (a.kind === 'moments' && known(`art-moment-${stem}`)) {
      return { surface: 'title', titleArt: `art-moment-${stem}`, swaps: [{ key: `art-moment-${stem}`, assetId: a.id }] };
    }
    if (a.kind && ['pages', 'inventory', 'cast-colors', 'pocket'].includes(a.kind)) {
      const t = known(`art-titlecast-${stem}`) ? `art-titlecast-${stem}` : titleArtFor(stem);
      if (t) return { surface: t === 'art-titlecast-leaderboard' ? 'leaderboard' : 'title', titleArt: t, swaps: [{ key: t, assetId: a.id }] };
    }
    return none;
  }

  // Wallpapers: wallpapers/wall-<tint|game-x>[-wide], seasons/<s>/walls/wall-<tint|games>[-wide].
  if (a.type === 'wallpapers' || (a.type === 'seasons' && a.kind === 'walls')) {
    const m = /^wall-(.+?)(-wide)?$/.exec(stem);
    if (!m) return none;
    const target = m[1] === 'games' ? 'home' : m[1];
    const tint = (TINTS as readonly string[]).includes(target) ? (target as PageTint) : 'home';
    const name = `art-wall-${tint === target || target.startsWith('game-') ? target : 'home'}`;
    return { surface: 'wallpaper', tint, wall: name, swaps: [{ key: name, assetId: a.id }, { key: `${name}-wide`, assetId: a.id }] };
  }

  // Buttons: skins/<color>-<s|m|l>[-pressed][-dark], labels/<slug>.
  if (a.type === 'buttons') {
    const skin = /^([a-z]+)-([sml])(-pressed)?(-dark)?$/.exec(stem);
    if (a.kind === 'skins' && skin) return { surface: 'buttons', buttonColor: skin[1], swaps: [{ key: `art-btn-${stem}`, assetId: a.id }] };
    if (a.kind === 'labels' && known(`art-btnlabel-${stem}`)) {
      return { surface: 'buttons', buttonColor: 'purple', label: stem, swaps: [{ key: `art-btnlabel-${stem}`, assetId: a.id }] };
    }
    return none;
  }

  // Mascot maker parts: art-av-<field>-<id> (parts/), or the same names without the prefix (new/, bodies/).
  if (a.type === 'mascot-maker' && (a.kind === 'parts' || a.kind === 'new' || a.kind === 'bodies')) {
    const m = /^(?:art-av-)?(body|eyes|mouth|nose|cheeks|acc)-(.+)$/.exec(stem);
    if (m) return { surface: 'mascot', part: { field: m[1], id: m[2] }, swaps: [{ key: `art-av-${m[1]}-${m[2]}`, assetId: a.id }] };
    return none;
  }

  if (a.type === 'widgets') return { surface: 'widget', swaps: [] };
  return none;
}

/** A season's chosen pieces: per cast member the approved costume, else the main one; plus approved-else-main titles. */
export function seasonPicks(assets: readonly ArtAsset[], season: string): ArtAsset[] {
  const pool = assets.filter((a) => a.season === season && a.stage !== 'working' && a.status !== 'rejected');
  const byTarget = new Map<string, ArtAsset[]>();
  for (const a of pool) {
    const plan = planFor(a);
    if (plan.surface === 'none' || !plan.swaps.length) continue;
    const key = plan.swaps[0].key;
    byTarget.set(key, [...(byTarget.get(key) ?? []), a]);
  }
  const rank = (a: ArtAsset) => (a.status === 'approved' ? 0 : a.status === 'shipped' ? 1 : /-alt\d+$/.test(a.id) ? 3 : 2);
  return Array.from(byTarget.values(), (list) => list.slice().sort((x, y) => rank(x) - rank(y) || x.id.localeCompare(y.id))[0]);
}
