import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

// The Weekly Five (distribution memo §14) as an API — DAU, retention cohorts,
// share rate, Pro conversion, reports — plus the auth-provider mix and
// guest→account conversions. Ports scripts/weekly-five.sql; aggregation happens
// here in TS against service-role reads, which at current scale is simpler and
// safer than shipping SQL functions to production. Revisit if row counts make
// these pulls heavy (the .sql file remains the reference implementation).

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const now = new Date();
  const since14 = new Date(now.getTime() - 14 * 86400000).toISOString();
  const since35 = new Date(now.getTime() - 35 * 86400000).toISOString();

  const [dailyRes, matchesRes, sharesRes, profilesRes, reportsRes, usersRes] = await Promise.all([
    admin.from('daily_results').select('user_id, day, play_type, created_at').gte('created_at', since35),
    admin.from('matches').select('player1_id, player2_id, created_at').gte('created_at', since14),
    admin.from('share_events').select('kind, game_mode, surface, created_at').gte('created_at', since14),
    // select * so the route works before AND after the converted_from_guest
    // migration lands — a named missing column would error the whole query.
    admin.from('profiles').select('*'),
    admin.from('reports').select('created_at').gte('created_at', new Date(now.getTime() - 30 * 86400000).toISOString()),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const daily = dailyRes.data ?? [];
  const matches = matchesRes.data ?? [];
  const shares = sharesRes.data ?? [];
  const profiles = profilesRes.data ?? [];
  const reports = reportsRes.data ?? [];
  const users = usersRes.data?.users ?? [];

  // 1. DAU, last 14 days — anyone who recorded a daily result or a match.
  const dauByDay = new Map<string, Set<string>>();
  const seen = (day: string, uid: string | null) => {
    if (!uid) return;
    if (!dauByDay.has(day)) dauByDay.set(day, new Set());
    dauByDay.get(day)!.add(uid);
  };
  for (const r of daily) seen(String(r.day).slice(0, 10), r.user_id);
  for (const m of matches) {
    const d = String(m.created_at).slice(0, 10);
    seen(d, m.player1_id);
    seen(d, m.player2_id);
  }
  const dau = Array.from({ length: 14 }, (_, i) => {
    const d = dayKey(new Date(now.getTime() - i * 86400000));
    return { day: d, dau: dauByDay.get(d)?.size ?? 0 };
  });

  // 2. D1/D7/D30 retention by first-played cohort (last 30 cohort days).
  const firstDay = new Map<string, string>();
  const activeDays = new Map<string, Set<string>>();
  for (const r of daily) {
    const d = String(r.day).slice(0, 10);
    if (!firstDay.has(r.user_id) || d < firstDay.get(r.user_id)!) firstDay.set(r.user_id, d);
    if (!activeDays.has(r.user_id)) activeDays.set(r.user_id, new Set());
    activeDays.get(r.user_id)!.add(d);
  }
  const plusDays = (key: string, n: number) => {
    const [y, m, d] = key.split('-').map(Number);
    return dayKey(new Date(Date.UTC(y, m - 1, d + n)));
  };
  const cohorts = new Map<string, { size: number; d1: number; d7: number; d30: number }>();
  for (const [uid, cohort] of firstDay) {
    if (!cohorts.has(cohort)) cohorts.set(cohort, { size: 0, d1: 0, d7: 0, d30: 0 });
    const c = cohorts.get(cohort)!;
    c.size++;
    const days = activeDays.get(uid)!;
    if (days.has(plusDays(cohort, 1))) c.d1++;
    if (days.has(plusDays(cohort, 7))) c.d7++;
    if (days.has(plusDays(cohort, 30))) c.d30++;
  }
  const retention = [...cohorts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .slice(0, 30)
    .map(([cohort, c]) => ({
      cohort,
      size: c.size,
      d1: c.size ? Math.round((1000 * c.d1) / c.size) / 10 : 0,
      d7: c.size ? Math.round((1000 * c.d7) / c.size) / 10 : 0,
      d30: c.size ? Math.round((1000 * c.d30) / c.size) / 10 : 0,
    }));

  // 3. Share rate per completed solo game, last 14 days + breakdowns.
  const completedByDay = new Map<string, number>();
  for (const r of daily) {
    if (r.play_type !== 'solo') continue;
    const d = String(r.day).slice(0, 10);
    completedByDay.set(d, (completedByDay.get(d) ?? 0) + 1);
  }
  const sharesByDay = new Map<string, number>();
  const shareByMode = new Map<string, number>();
  const shareBySurface = new Map<string, number>();
  const shareByKind = new Map<string, number>();
  for (const s of shares) {
    const d = String(s.created_at).slice(0, 10);
    sharesByDay.set(d, (sharesByDay.get(d) ?? 0) + 1);
    if (s.game_mode) shareByMode.set(s.game_mode, (shareByMode.get(s.game_mode) ?? 0) + 1);
    if (s.surface) shareBySurface.set(s.surface, (shareBySurface.get(s.surface) ?? 0) + 1);
    if (s.kind) shareByKind.set(s.kind, (shareByKind.get(s.kind) ?? 0) + 1);
  }
  const shareRate = Array.from({ length: 14 }, (_, i) => {
    const d = dayKey(new Date(now.getTime() - i * 86400000));
    const games = completedByDay.get(d) ?? 0;
    const sh = sharesByDay.get(d) ?? 0;
    return { day: d, games, shares: sh, rate: games ? Math.round((1000 * sh) / games) / 10 : 0 };
  });
  const top = (m: Map<string, number>) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ key: k, count: v }));

  // 4. Pro conversion + auth mix + guest conversions.
  const providers = new Map<string, number>();
  for (const u of users) {
    const list: string[] =
      u.app_metadata?.providers ?? (u.app_metadata?.provider ? [u.app_metadata.provider] : []);
    for (const p of list) providers.set(p, (providers.get(p) ?? 0) + 1);
  }
  const summary = {
    totalProfiles: profiles.length,
    activePro: profiles.filter((p) => p.is_pro).length,
    webCustomers: profiles.filter((p) => p.stripe_customer_id).length,
    proPct: profiles.length
      ? Math.round((10000 * profiles.filter((p) => p.is_pro).length) / profiles.length) / 100
      : 0,
    guestConversions: profiles.filter((p) => p.converted_from_guest).length,
    signups7d: profiles.filter((p) => p.created_at >= new Date(now.getTime() - 7 * 86400000).toISOString()).length,
  };

  // 5. Reports filed (moderation load), last 30 days.
  const reportsByDay = new Map<string, number>();
  for (const r of reports) {
    const d = String(r.created_at).slice(0, 10);
    reportsByDay.set(d, (reportsByDay.get(d) ?? 0) + 1);
  }
  const reportsDaily = [...reportsByDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([day, count]) => ({ day, count }));

  return NextResponse.json({
    dau,
    retention,
    shareRate,
    shareBreakdown: { byMode: top(shareByMode), bySurface: top(shareBySurface), byKind: top(shareByKind) },
    summary,
    providers: top(providers),
    reportsDaily,
  });
}
