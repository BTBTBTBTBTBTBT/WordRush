import type { SupabaseClient } from '@supabase/supabase-js';
import { AVATAR_ACCESS_TABLE } from '@wordle-duel/core';

/**
 * The owned-items ledger, server side (supabase/manual-migrations/20261009000005_owned_items.sql). The ledger is
 * written ONLY here, through admin-checked routes (service role); every grant / revoke is also logged to
 * owned_items_log. An owned row makes a mascot part saveable without Pro (core avatarPartAccess reads it).
 */
export const ITEM_KEY_RE = /^[a-zA-Z]+:[a-z0-9-]+$/;
export const MAX_KEYS_PER_CALL = 200;

/** Item keys an admin may grant: every key of the access table (the parts gating covers). */
export function grantableKeys(): Set<string> {
  return new Set(Object.keys(AVATAR_ACCESS_TABLE.parts));
}

/** Split a request's keys into valid / unknown (deduped, capped). */
export function sanitizeKeys(raw: unknown, allowed: Set<string> = grantableKeys()): { keys: string[]; unknown: string[] } {
  const list = Array.isArray(raw) ? raw.filter((k): k is string => typeof k === 'string').map((k) => k.trim()) : [];
  const uniq = Array.from(new Set(list)).slice(0, MAX_KEYS_PER_CALL);
  return {
    keys: uniq.filter((k) => ITEM_KEY_RE.test(k) && allowed.has(k)),
    unknown: uniq.filter((k) => !(ITEM_KEY_RE.test(k) && allowed.has(k))),
  };
}

export interface OwnedRow { item_key: string; source: string; granted_by: string | null; acquired_at: string; revoked_at: string | null }

/** Grant keys to a user: new or revoked rows become an active 'grant'; an active row (a purchase, an earn) is left alone. */
export async function grantItems(admin: SupabaseClient, userId: string, keys: string[], actor: string): Promise<{ granted: string[]; alreadyHad: string[] }> {
  if (keys.length === 0) return { granted: [], alreadyHad: [] };
  const { data: existing } = await admin.from('owned_items').select('item_key, revoked_at').eq('user_id', userId).in('item_key', keys);
  const active = new Set((existing ?? []).filter((r: { revoked_at: string | null }) => !r.revoked_at).map((r: { item_key: string }) => r.item_key));
  const toGrant = keys.filter((k) => !active.has(k));
  if (toGrant.length > 0) {
    const now = new Date().toISOString();
    const { error } = await admin.from('owned_items').upsert(
      toGrant.map((item_key) => ({ user_id: userId, item_key, source: 'grant', granted_by: actor, platform: 'server', acquired_at: now, revoked_at: null })),
      { onConflict: 'user_id,item_key' },
    );
    if (error) throw new Error(error.message);
    await admin.from('owned_items_log').insert(toGrant.map((item_key) => ({ user_id: userId, item_key, action: 'grant', source: 'grant', actor })));
  }
  return { granted: toGrant, alreadyHad: keys.filter((k) => active.has(k)) };
}

/** Revoke keys (the row stays for the audit trail; access ignores revoked rows). */
export async function revokeItems(admin: SupabaseClient, userId: string, keys: string[], actor: string): Promise<string[]> {
  if (keys.length === 0) return [];
  const { data } = await admin.from('owned_items').update({ revoked_at: new Date().toISOString() })
    .eq('user_id', userId).in('item_key', keys).is('revoked_at', null).select('item_key, source');
  const rows = (data ?? []) as Array<{ item_key: string; source: string }>;
  if (rows.length > 0) {
    await admin.from('owned_items_log').insert(rows.map((r) => ({ user_id: userId, item_key: r.item_key, action: 'revoke', source: r.source, actor })));
  }
  return rows.map((r) => r.item_key);
}
