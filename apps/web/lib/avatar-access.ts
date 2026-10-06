// Mascot item gating on the web (docs/cloud-prompts/11; core packages/core/src/avatar-access.ts). Behind the core flag
// AVATAR_ACCESS_CONFIG.itemGating (OFF): with it off the maker keeps today's Pro pill → Go Pro and enforceAvatarPro.
// The access context comes from data the client already has: the profile (level / streaks), the unlocked achievement
// keys, and the owned-items ledger (docs/sql/20261010-owned-items.sql — NOT applied yet, so owned is empty).
// No real purchases yet: buyAvatarItem is a stub.

import { AVATAR_ACCESS_CONFIG, type AvatarEarnStats } from '@wordle-duel/core';

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

/** The player's owned item keys (the owned_items ledger). TODO: read my_owned_items once the SQL is applied. */
export async function loadOwnedItems(): Promise<string[]> {
  return [];
}

export type ItemPurchaseResult = { ok: true } | { ok: false; reason: 'coming-soon' };

/** STUB: a direct, non-consumable item purchase (Stripe on the web, IAP in the apps). Not built yet. */
export async function buyAvatarItem(itemKey: string): Promise<ItemPurchaseResult> {
  void itemKey;
  return { ok: false, reason: 'coming-soon' };
}
