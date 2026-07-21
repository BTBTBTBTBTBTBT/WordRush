import { supabase } from './supabase-client';

/**
 * User-generated-content moderation (App Review 1.2 parity with iOS
 * ModerationService.swift): report + block.
 *
 * Backed by the `reports` (insert-only) and `blocks` (own-rows) tables from
 * manual-migration 20260721000001_prelaunch_hardening.sql.
 *
 * Blocked ids are cached module-level per session (loaded once) and applied
 * as a client-side filter wherever strangers' usernames render
 * (leaderboards, records). All calls are best-effort: failures return
 * false / no-throw, matching the native service.
 */

/** In-memory cache of who the signed-in user has blocked (lowercase ids).
 *  Loaded lazily once per session, updated optimistically on block/unblock. */
let blockedIds = new Set<string>();
let loaded = false;

/**
 * File a report against a user. Insert-only (no client SELECT policy);
 * reports are reviewed via the admin service role.
 */
export async function reportUser(
  reporterId: string,
  reportedUserId: string,
  reason: string,
  context: string,
): Promise<boolean> {
  try {
    const { error } = await (supabase as any).from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: reportedUserId,
      reason: reason.slice(0, 500),
      context: context.slice(0, 200),
    });
    return !error;
  } catch {
    return false;
  }
}

/** Block a user. Optimistic: the cache updates immediately; a duplicate-PK
 *  failure means "already blocked" and still counts as success. */
export async function blockUser(blockerId: string, blockedId: string): Promise<boolean> {
  blockedIds.add(blockedId.toLowerCase());
  try {
    await (supabase as any).from('blocks').insert({
      blocker_id: blockerId,
      blocked_id: blockedId,
    });
    return true;
  } catch {
    return true; // optimistic: duplicate PK = already blocked
  }
}

/** Unblock a user. Best-effort delete; cache is updated optimistically. */
export async function unblockUser(blockerId: string, blockedId: string): Promise<boolean> {
  blockedIds.delete(blockedId.toLowerCase());
  try {
    const { error } = await (supabase as any)
      .from('blocks')
      .delete()
      .eq('blocker_id', blockerId)
      .eq('blocked_id', blockedId);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Load (once per session) the signed-in user's block list into the
 * module-level cache. Subsequent calls return the cached set. On failure the
 * cache stays unloaded so a later call can retry.
 */
export async function fetchBlockedIds(userId: string): Promise<Set<string>> {
  if (loaded) return blockedIds;
  try {
    const { data, error } = await (supabase as any)
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', userId);
    if (error) return blockedIds; // retry next call
    blockedIds = new Set(
      ((data as Array<{ blocked_id: string }> | null) || []).map((r) => r.blocked_id.toLowerCase()),
    );
    loaded = true;
  } catch {
    // retry next call
  }
  return blockedIds;
}

/** Whether the signed-in user has blocked this id (from the session cache). */
export function isBlocked(userId: string): boolean {
  return blockedIds.has(userId.toLowerCase());
}
