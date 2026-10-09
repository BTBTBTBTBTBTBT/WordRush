// Mascot item gating on the web (docs/cloud-prompts/11; core packages/core/src/avatar-access.ts). Behind the core flag
// AVATAR_ACCESS_CONFIG.itemGating (OFF): with it off the maker keeps today's Pro pill → Go Pro and enforceAvatarPro.
// The access context comes from data the client already has: the profile (level / streaks), the unlocked achievement
// keys, and the owned-items ledger (docs/sql/20261010-owned-items.sql — NOT applied yet, so owned is empty).
// No real purchases yet: buyAvatarItem is a stub.

import { AVATAR_ACCESS_CONFIG, avatarAccessKey, type AvatarConfig, type AvatarEarnStats } from '@wordle-duel/core';
import { supabase } from './supabase-client';

export const ITEM_GATING_ON: boolean = AVATAR_ACCESS_CONFIG.itemGating;

/** The earn evaluator's input from a profile row (+ the player's unlocked achievement keys). */
export function earnStatsFromProfile(profile: Record<string, unknown> | null | undefined, achievements?: Iterable<string> | null): AvatarEarnStats {
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const p = profile ?? {};
  return {
    level: n(p.level),
    currentStreak: n(p.current_streak),
    bestStreak: n(p.best_streak),
    bestLoginStreak: n(p.best_daily_login_streak),
    achievements: achievements ? Array.from(achievements) : [],
  };
}

/**
 * The player's owned item keys: the owned_items ledger through the my_owned_items view (RLS: your own active rows;
 * supabase/manual-migrations/20261009000005_owned_items.sql). [] when signed out, offline, or before the SQL is applied.
 */
export async function loadOwnedItems(): Promise<string[]> {
  try {
    const { data, error } = await (supabase as any).from('my_owned_items').select('item_key');
    if (error || !Array.isArray(data)) return [];
    return data.map((r: { item_key: unknown }) => String(r.item_key));
  } catch {
    return [];
  }
}

/**
 * Owned items save without Pro. enforceAvatarPro (the gating-off save path) strips every Pro-only part for a free
 * player; this puts back the ones the player OWNS (an admin grant, an earn, a purchase). `enforced` is the stripped
 * config, `original` what the player picked.
 */
export function keepOwnedParts(original: AvatarConfig, enforced: AvatarConfig, owned: readonly string[]): AvatarConfig {
  if (owned.length === 0) return enforced;
  const out = { ...enforced } as Record<string, unknown>;
  const o = original as unknown as Record<string, unknown>;
  for (const field of Object.keys(o)) {
    const id = o[field];
    if (typeof id !== 'string' || out[field] === id) continue;
    if (owned.includes(avatarAccessKey(field, id))) out[field] = id;
  }
  return out as unknown as AvatarConfig;
}

export type ItemPurchaseResult = { ok: true } | { ok: false; reason: 'coming-soon' };

/** STUB: a direct, non-consumable item purchase (Stripe on the web, IAP in the apps). Not built yet. */
export async function buyAvatarItem(itemKey: string): Promise<ItemPurchaseResult> {
  void itemKey;
  return { ok: false, reason: 'coming-soon' };
}
