// Mascot item gating (docs/cloud-prompts/11, decisions in docs/design/brand/avatar/UNLOCKS-AND-SHOP.md): who may SAVE
// which part. Every option has an access rule (avatar-access.json, generated from the PROPOSED table by
// docs/design/brand/avatar/access/make-access-table.py — the founder approves it later):
//   free · pro (included with Pro) · buy (a direct purchase at a price tier) · earn (a condition on existing Stats /
//   achievements) · season (free in its window, avatar-season.ts) · limited (the buy route only opens in the window).
// Try-on rule: ANY part can be previewed on the Stage; only saving checks access (avatarSaveCheck / enforceAvatarAccess).
// A part the player already SAVED is never stripped (grandfathered), like the seasonal rule.
//
// Everything ships behind AVATAR_ACCESS_CONFIG.itemGating (OFF): with it off, avatarPartRule returns today's rules
// (the AVATAR_PRO_ONLY lists + the level-earned tier frames + seasons) so nothing changes for anyone.
// Pure; pinned across TS / Swift / Kotlin by avatar-access-fixtures.json. No real purchases yet: ownership comes in as
// a list of owned keys (the server-side owned_items ledger, docs/sql/20261010-owned-items.sql — NOT applied).

import accessJson from './avatar-access.json';
import { AVATAR_PRO_ONLY, type AvatarConfig } from './avatar-config';
import { avatarPartSeason, mascotSeason, type AvatarPart } from './avatar-season';
import { AVATAR_MANIFEST, type AvatarManifest } from './avatar-layout';

/** The feature flag (OFF until the founder approves the table and the purchase flow ships). */
export const AVATAR_ACCESS_CONFIG = {
  itemGating: false,
} as const;

export type AvatarPriceTier = 't1' | 't2' | 't3' | 't4';
/** The profile stats an earn condition may read (profiles.level / current_streak / best_streak / best_daily_login_streak). */
export type AvatarEarnStat = 'level' | 'currentStreak' | 'bestStreak' | 'bestLoginStreak';

/** One earn condition: an existing achievement, or a stat at least `min`. `label` is the locked card's copy. */
export interface AvatarEarnCondition {
  label: string;
  achievement?: string;
  stat?: AvatarEarnStat;
  min?: number;
}

export interface AvatarAccessRule {
  free?: boolean;
  pro?: boolean;
  buy?: AvatarPriceTier;
  earn?: AvatarEarnCondition;
  /** A seasonal part (its season id): free while the season is on. */
  season?: string;
  /** The buy / earn routes only open while `season` is on (out of season: retired until next year). */
  limited?: boolean;
}

export interface AvatarAccessTable {
  version: number;
  tiers: Readonly<Record<AvatarPriceTier, number>>;
  parts: Readonly<Record<string, AvatarAccessRule>>;
}

export const AVATAR_ACCESS_TABLE = accessJson as unknown as AvatarAccessTable;

/** What the earn evaluator reads: profile stats + the player's unlocked achievement keys. */
export interface AvatarEarnStats {
  level?: number;
  currentStreak?: number;
  bestStreak?: number;
  bestLoginStreak?: number;
  achievements?: readonly string[];
}

/** The fields gating covers, in the maker's order (patternColor / accColor share the color keys). */
export const AVATAR_ACCESS_FIELDS = [
  'body', 'color', 'pattern', 'patternColor', 'eyes', 'brows', 'nose', 'cheeks', 'mouth', 'extra',
  'head', 'face', 'neck', 'held', 'wrap', 'feet', 'pet', 'accColor', 'frame', 'bg', 'pose',
] as const;

/** The table key of a part: "<field>:<id>"; the three color fields share "color:<id>". */
export function avatarAccessKey(field: string, id: string): string {
  const f = field === 'patternColor' || field === 'accColor' ? 'color' : field;
  return `${f}:${id}`;
}

/** Ids that are always free (the empty choice of every field). */
export function avatarAccessAlwaysFree(field: string, id: string): boolean {
  if (!id || id === 'none') return true;
  if (field === 'pattern' && id === 'solid') return true;
  if (field === 'bg' && id === 'auto') return true;
  if (field === 'accColor' && id === 'default') return true;
  return false;
}

/** The level a tier frame is earned at (today's rule: FRAME_UNLOCK_LEVEL on every platform). */
export const AVATAR_FRAME_LEVEL: Readonly<Record<string, number>> = { bronze: 1, silver: 11, gold: 26, platinum: 51 };

/** Today's rules (gating OFF): Pro-only lists, level frames, seasons; everything else free. */
export function avatarLegacyRule(field: string, id: string, manifest: AvatarManifest = AVATAR_MANIFEST): AvatarAccessRule {
  if (avatarAccessAlwaysFree(field, id)) return { free: true };
  const season = avatarPartSeason(field, id, manifest);
  if (season) return { season };
  if (field === 'frame' && AVATAR_FRAME_LEVEL[id] != null) {
    const n = AVATAR_FRAME_LEVEL[id];
    return { earn: { label: `Reach level ${n}`, stat: 'level', min: n } };
  }
  const key = field === 'patternColor' || field === 'accColor' ? 'color' : field;
  const list = (AVATAR_PRO_ONLY as Record<string, readonly string[] | undefined>)[key];
  return list && list.includes(id) ? { pro: true } : { free: true };
}

/**
 * A part's rule. Gating on: the table's (a part missing from the table is free — never lock what nobody priced);
 * the manifest's `season` always wins the season field. Gating off: today's rules (avatarLegacyRule).
 */
export function avatarPartRule(
  field: string,
  id: string,
  { gating = AVATAR_ACCESS_CONFIG.itemGating, table = AVATAR_ACCESS_TABLE, manifest = AVATAR_MANIFEST }: { gating?: boolean; table?: AvatarAccessTable; manifest?: AvatarManifest } = {},
): AvatarAccessRule {
  if (!gating) return avatarLegacyRule(field, id, manifest);
  if (avatarAccessAlwaysFree(field, id)) return { free: true };
  const rule = table.parts[avatarAccessKey(field, id)] ?? { free: true };
  const season = avatarPartSeason(field, id, manifest);
  return season ? { ...rule, season } : rule;
}

// ── The earn evaluator ──────────────────────────────────────────────────────────────────────────────────

export interface AvatarEarnProgress {
  met: boolean;
  /** Where the player is (a stat value, capped at target; an achievement: 0 or 1). */
  current: number;
  target: number;
  label: string;
}

/** Evaluate one earn condition against the player's stats + achievements. Pure. */
export function evaluateEarn(cond: AvatarEarnCondition, stats: AvatarEarnStats | null | undefined): AvatarEarnProgress {
  const s = stats ?? {};
  if (cond.achievement) {
    const met = (s.achievements ?? []).includes(cond.achievement);
    return { met, current: met ? 1 : 0, target: 1, label: cond.label };
  }
  if (cond.stat) {
    const target = Math.max(1, Math.floor(cond.min ?? 1));
    const raw = Number(s[cond.stat] ?? 0);
    const value = Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    return { met: value >= target, current: Math.min(value, target), target, label: cond.label };
  }
  return { met: false, current: 0, target: 1, label: cond.label };
}

/**
 * The parts a player's stats have earned (what the server writes to owned_items with source 'earn').
 * Every table key whose earn condition is met, in table order.
 */
export function avatarEarnedKeys(stats: AvatarEarnStats | null | undefined, table: AvatarAccessTable = AVATAR_ACCESS_TABLE): string[] {
  const out: string[] = [];
  for (const [key, rule] of Object.entries(table.parts)) if (rule.earn && evaluateEarn(rule.earn, stats).met) out.push(key);
  return out;
}

// ── Access ──────────────────────────────────────────────────────────────────────────────────────────────

export interface AvatarAccessContext {
  isPro: boolean;
  /** Owned keys ("<field>:<id>", the owned_items ledger: bought or earned). */
  owned?: readonly string[];
  stats?: AvatarEarnStats | null;
  /** "yyyy-MM-dd" (or a Date) — for seasons. */
  date: string | Date;
  /** The admin Season preview (avatar-season.ts). */
  previewSeason?: string | null;
  /** The player's SAVED config: a part it wears is never stripped. */
  saved?: Partial<AvatarConfig> | null;
  /** Defaults to AVATAR_ACCESS_CONFIG.itemGating. */
  gating?: boolean;
}

export type AvatarAccessReason = 'free' | 'pro' | 'owned' | 'earned' | 'season' | 'saved' | 'locked';

/** One way to get a locked part (the locked card lists them in this order). */
export type AvatarAccessRoute =
  | { kind: 'buy'; tier: AvatarPriceTier; price: number }
  | { kind: 'pro' }
  | { kind: 'earn'; progress: AvatarEarnProgress }
  | { kind: 'season'; season: string };

export interface AvatarPartAccess {
  unlocked: boolean;
  reason: AvatarAccessReason;
  /** The routes that apply (shown on the locked card; also present when unlocked, for the item's info). */
  routes: AvatarAccessRoute[];
  rule: AvatarAccessRule;
}

/** The config field a part lives in, read from any config shape. */
function wornId(config: Partial<AvatarConfig> | null | undefined, field: string): string | undefined {
  const v = config ? (config as Record<string, unknown>)[field] : undefined;
  return typeof v === 'string' ? v : undefined;
}

/** Does the saved config wear this part (in this field — or, for a color, as any of the three color fields)? */
function savedWears(saved: Partial<AvatarConfig> | null | undefined, field: string, id: string): boolean {
  if (!saved) return false;
  if (field === 'color' || field === 'patternColor' || field === 'accColor') {
    return ['color', 'patternColor', 'accColor'].some((f) => wornId(saved, f) === id);
  }
  return wornId(saved, field) === id;
}

/** May this player save this part, and if not, how can they get it? Pure. */
export function avatarPartAccess(
  part: AvatarPart,
  ctx: AvatarAccessContext,
  { table = AVATAR_ACCESS_TABLE, manifest = AVATAR_MANIFEST }: { table?: AvatarAccessTable; manifest?: AvatarManifest } = {},
): AvatarPartAccess {
  const gating = ctx.gating ?? AVATAR_ACCESS_CONFIG.itemGating;
  const rule = avatarPartRule(part.field, part.id, { gating, table, manifest });
  const inSeason = !!rule.season && mascotSeason(ctx.date, ctx.previewSeason) === rule.season;
  const routes: AvatarAccessRoute[] = [];
  if (rule.season) routes.push({ kind: 'season', season: rule.season });
  const routesOpen = !rule.limited || inSeason;
  if (rule.buy && routesOpen) routes.push({ kind: 'buy', tier: rule.buy, price: table.tiers[rule.buy] });
  if (rule.pro) routes.push({ kind: 'pro' });
  const earn = rule.earn && routesOpen ? evaluateEarn(rule.earn, ctx.stats) : null;
  if (earn) routes.push({ kind: 'earn', progress: earn });
  const done = (reason: AvatarAccessReason): AvatarPartAccess => ({ unlocked: reason !== 'locked', reason, routes, rule });

  if (rule.free) return done('free');
  if (inSeason) return done('season');
  if (rule.pro && ctx.isPro) return done('pro');
  if ((ctx.owned ?? []).includes(avatarAccessKey(part.field, part.id))) return done('owned');
  if (earn?.met) return done('earned');
  if (savedWears(ctx.saved, part.field, part.id)) return done('saved');
  return done('locked');
}

/** The parts a config wears that gating covers (skipping the empty choices and unused color fields). */
export function avatarWornParts(config: Partial<AvatarConfig>): AvatarPart[] {
  const out: AvatarPart[] = [];
  for (const field of AVATAR_ACCESS_FIELDS) {
    const id = wornId(config, field);
    if (!id || avatarAccessAlwaysFree(field, id)) continue;
    if (field === 'patternColor' && (wornId(config, 'pattern') ?? 'solid') === 'solid') continue;
    out.push({ field, id });
  }
  return out;
}

export interface AvatarSaveCheck {
  ok: boolean;
  /** The worn parts the player can't save yet (try-on only), in maker order. */
  locked: AvatarPart[];
}

/** The try-on rule: anything previews; saving needs every worn part unlocked. */
export function avatarSaveCheck(draft: Partial<AvatarConfig>, ctx: AvatarAccessContext, opts: { table?: AvatarAccessTable; manifest?: AvatarManifest } = {}): AvatarSaveCheck {
  const locked = avatarWornParts(draft).filter((p) => !avatarPartAccess(p, ctx, opts).unlocked);
  return { ok: locked.length === 0, locked };
}

/** What a locked part falls back to when saving anyway: the saved config's value, else the field's free default. */
const ACCESS_FALLBACK: Readonly<Record<string, string>> = {
  body: 'classic', color: 'purple', pattern: 'solid', patternColor: 'purple', accColor: 'default', bg: 'auto', frame: 'none',
};

/**
 * Strip the locked parts (save-time enforcement, like enforceAvatarPro): each locked part reverts to the SAVED
 * config's value when that one is unlocked, else to the field's free default ('none' for parts). Integrated parts
 * and the pose revert by deletion (a missing field = 'none').
 */
export function enforceAvatarAccess(draft: AvatarConfig, ctx: AvatarAccessContext, opts: { table?: AvatarAccessTable; manifest?: AvatarManifest } = {}): AvatarConfig {
  const { locked } = avatarSaveCheck(draft, ctx, opts);
  if (locked.length === 0) return draft;
  const out = { ...draft } as Record<string, unknown>;
  for (const p of locked) {
    const prior = wornId(ctx.saved, p.field);
    const priorOk = !!prior && prior !== p.id && (avatarAccessAlwaysFree(p.field, prior) || avatarPartAccess({ field: p.field, id: prior }, ctx, opts).unlocked);
    const next = priorOk ? prior! : ACCESS_FALLBACK[p.field] ?? 'none';
    if (next === 'none' && ['held', 'wrap', 'feet', 'pet', 'brows', 'extra', 'pose'].includes(p.field)) delete out[p.field];
    else out[p.field] = next;
  }
  return out as unknown as AvatarConfig;
}

// ── The locked card ─────────────────────────────────────────────────────────────────────────────────────

/** A price for display ("$1.99"). */
export function avatarPriceLabel(price: number): string {
  return `$${price.toFixed(2)}`;
}

/** One line of the locked card per route ("Buy $1.99" · "Included with Pro" · "Earn: … (12 / 30)" · "Free in Halloween"). */
export function avatarRouteLine(route: AvatarAccessRoute): string {
  switch (route.kind) {
    case 'buy': return `Buy ${avatarPriceLabel(route.price)}`;
    case 'pro': return 'Included with Pro';
    case 'earn': {
      const p = route.progress;
      return p.target > 1 ? `Earn: ${p.label} (${p.current} / ${p.target})` : `Earn: ${p.label}`;
    }
    case 'season': return `Free during ${route.season.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}`;
  }
}

/** The locked card's routes, in order: earn first (play beats pay), then Pro, then buy; season info last. */
export function avatarLockedCardLines(access: AvatarPartAccess): string[] {
  const order: Record<AvatarAccessRoute['kind'], number> = { earn: 0, pro: 1, buy: 2, season: 3 };
  return [...access.routes].sort((a, b) => order[a.kind] - order[b.kind]).map(avatarRouteLine);
}
