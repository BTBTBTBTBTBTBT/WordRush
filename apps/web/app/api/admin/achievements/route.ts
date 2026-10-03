import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { ACHIEVEMENT_CATALOG } from '@/lib/achievement-service';
import { sweepAll } from '@/lib/supabase-sweep';
import { levelTier, levelTierLabel, type LevelTier } from '@wordle-duel/core';
import { headCount, inBatches, isoDaysAgo, usernames } from '@/lib/admin/admin-queries';

export const dynamic = 'force-dynamic';

/**
 * admin > Progression > Achievements: the whole catalog (lib/achievement-service
 * ACHIEVEMENT_CATALOG = the original set + core NEW_ACHIEVEMENTS, hidden ones
 * included and flagged), unlock counts per achievement (all-time + last 7
 * days), and the most recent unlocks. Counts are per-key head queries, so no
 * migration and no 1,000-row cap; read-only.
 */
export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const since7 = isoDaysAgo(7);
  const since1 = isoDaysAgo(1);

  const counts = await inBatches(ACHIEVEMENT_CATALOG, 16, async (a) => {
    const [total, week] = await Promise.all([
      headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).eq('achievement_key', a.key)),
      headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).eq('achievement_key', a.key).gte('unlocked_at', since7)),
    ]);
    return { key: a.key, total, week };
  });
  const byKey = new Map(counts.map((c) => [c.key, c]));

  const [allTime, last24h, last7, players, recentRes, levels] = await Promise.all([
    headCount(admin.from('achievements').select('id', { count: 'exact', head: true })),
    headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).gte('unlocked_at', since1)),
    headCount(admin.from('achievements').select('id', { count: 'exact', head: true }).gte('unlocked_at', since7)),
    headCount(admin.from('profiles').select('id', { count: 'exact', head: true })),
    admin.from('achievements').select('user_id, achievement_key, unlocked_at').order('unlocked_at', { ascending: false }).limit(40),
    // Levels: every player's level, bucketed into the core level tiers (the badge/frame tiers).
    sweepAll<{ level: number | null }>((f, t) => admin.from('profiles').select('level').order('id').range(f, t)),
  ]);

  const TIERS: LevelTier[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const tierCounts = new Map<LevelTier, number>(TIERS.map((t) => [t, 0]));
  let maxLevel = 0;
  for (const p of levels) {
    const lv = p.level ?? 1;
    maxLevel = Math.max(maxLevel, lv);
    const t = levelTier(lv);
    tierCounts.set(t, (tierCounts.get(t) ?? 0) + 1);
  }

  const recentRows = (recentRes.data ?? []) as Array<{ user_id: string; achievement_key: string; unlocked_at: string }>;
  const names = await usernames(admin, recentRows.map((r) => r.user_id));
  const nameOf = new Map(ACHIEVEMENT_CATALOG.map((a) => [a.key, a.name]));
  const known = new Set(ACHIEVEMENT_CATALOG.map((a) => a.key));

  return NextResponse.json({
    totals: { allTime, last24h, last7, players, catalog: ACHIEVEMENT_CATALOG.length, hidden: ACHIEVEMENT_CATALOG.filter((a) => a.hidden).length },
    levels: {
      maxLevel,
      tiers: TIERS.map((t) => ({ tier: levelTierLabel(t), count: tierCounts.get(t) ?? 0 })),
    },
    achievements: ACHIEVEMENT_CATALOG.map((a) => ({
      key: a.key,
      name: a.name,
      description: a.description,
      category: a.category,
      icon: a.icon,
      xp: a.xp ?? null,
      hidden: !!a.hidden,
      unlocks: byKey.get(a.key)?.total ?? null,
      unlocks7d: byKey.get(a.key)?.week ?? null,
    })),
    recent: recentRows.map((r) => ({
      userId: r.user_id,
      player: names.get(r.user_id) ?? r.user_id.slice(0, 8),
      key: r.achievement_key,
      name: nameOf.get(r.achievement_key) ?? r.achievement_key,
      // A key no longer in the catalog (renamed or retired) — worth a look.
      unknown: !known.has(r.achievement_key),
      unlocked_at: r.unlocked_at,
    })),
  });
}
