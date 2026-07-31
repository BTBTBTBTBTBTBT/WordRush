import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/admin-auth';
import { getAdminSupabase } from '@/lib/supabase-admin';

// Drill-down behind every number in the admin portal: "5.1% share rate" is
// only actionable if you can ask WHICH shares. One route serves every page
// (Dashboard, Metrics, Puzzles, Ops, Payments, Referrals) because they all
// want the same thing — the rows behind a figure — and a uniform
// { title, subtitle, columns, rows } shape lets ONE client component render
// all of them. `userId` on a row turns it into a link to that player's page.
type Col = { key: string; label: string };

const iso = (d: Date) => d.toISOString();
const dayStart = (key: string) => `${key}T00:00:00.000Z`;
const dayEnd = (key: string) => `${key}T23:59:59.999Z`;
const fmtTime = (t: string) =>
  new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export async function GET(request: NextRequest) {
  const auth = await verifyAdmin(request);
  if ('error' in auth) return auth.error;

  const admin = getAdminSupabase();
  const p = request.nextUrl.searchParams;
  const metric = p.get('metric') ?? '';
  const day = p.get('day');
  const key = p.get('key');
  const now = new Date();

  // Username lookup shared by most metrics.
  const nameOf = async (ids: string[]) => {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) return new Map<string, string>();
    const { data } = await admin.from('profiles').select('id, username').in('id', unique);
    return new Map((data ?? []).map((r) => [r.id as string, (r.username as string) ?? r.id]));
  };

  const ok = (title: string, subtitle: string, columns: Col[], rows: Record<string, unknown>[]) =>
    NextResponse.json({ title, subtitle, columns, rows });

  if (metric === 'dau') {
    const d = day ?? iso(now).slice(0, 10);
    const [drRes, mRes] = await Promise.all([
      admin.from('daily_results').select('user_id, game_mode, play_type, completed, composite_score').eq('day', d),
      admin.from('matches').select('player1_id, player2_id, created_at').gte('created_at', dayStart(d)).lte('created_at', dayEnd(d)),
    ]);
    const per = new Map<string, { modes: Set<string>; wins: number; games: number; vs: number }>();
    for (const r of drRes.data ?? []) {
      if (!per.has(r.user_id)) per.set(r.user_id, { modes: new Set(), wins: 0, games: 0, vs: 0 });
      const c = per.get(r.user_id)!;
      c.modes.add(r.game_mode);
      c.games++;
      if (r.completed) c.wins++;
    }
    for (const m of mRes.data ?? []) {
      for (const id of [m.player1_id, m.player2_id]) {
        if (!id) continue;
        if (!per.has(id)) per.set(id, { modes: new Set(), wins: 0, games: 0, vs: 0 });
        per.get(id)!.vs++;
      }
    }
    const names = await nameOf([...per.keys()]);
    const rows = [...per.entries()]
      .map(([id, c]) => ({
        userId: id,
        player: names.get(id) ?? id,
        dailies: c.games,
        wins: c.wins,
        vs: c.vs,
        modes: [...c.modes].sort().join(', ') || '—',
      }))
      .sort((a, b) => b.dailies + b.vs - (a.dailies + a.vs));
    return ok(`Active players — ${d}`, `${rows.length} player${rows.length === 1 ? '' : 's'} recorded a game`, [
      { key: 'player', label: 'Player' },
      { key: 'dailies', label: 'Dailies' },
      { key: 'wins', label: 'Wins' },
      { key: 'vs', label: 'VS' },
      { key: 'modes', label: 'Modes played' },
    ], rows);
  }

  if (metric === 'shares') {
    let q = admin
      .from('share_events')
      .select('user_id, platform, game_mode, kind, surface, created_at')
      .order('created_at', { ascending: false })
      .limit(200);
    if (day) q = q.gte('created_at', dayStart(day)).lte('created_at', dayEnd(day));
    else q = q.gte('created_at', iso(new Date(now.getTime() - 14 * 86400000)));
    if (key && p.get('by') === 'mode') q = q.eq('game_mode', key);
    if (key && p.get('by') === 'surface') q = q.eq('surface', key);
    const { data } = await q;
    const names = await nameOf((data ?? []).map((r) => r.user_id).filter(Boolean) as string[]);
    const rows = (data ?? []).map((r) => ({
      userId: r.user_id,
      player: r.user_id ? names.get(r.user_id) ?? r.user_id : 'guest',
      mode: r.game_mode || '—',
      kind: r.kind,
      surface: r.surface || '—',
      platform: r.platform,
      when: fmtTime(r.created_at),
    }));
    return ok(
      day ? `Shares — ${day}` : key ? `Shares — ${key}` : 'Shares — last 14 days',
      `${rows.length} share event${rows.length === 1 ? '' : 's'}`,
      [
        { key: 'player', label: 'Player' },
        { key: 'mode', label: 'Mode' },
        { key: 'kind', label: 'Kind' },
        { key: 'surface', label: 'Surface' },
        { key: 'platform', label: 'Platform' },
        { key: 'when', label: 'When' },
      ],
      rows,
    );
  }

  if (metric === 'pro') {
    const { data } = await admin
      .from('profiles')
      .select('id, username, pro_expires_at, stripe_customer_id, stripe_subscription_id, created_at')
      .eq('is_pro', true)
      .order('pro_expires_at', { ascending: true });
    const rows = (data ?? []).map((r) => {
      const live = !r.pro_expires_at || new Date(r.pro_expires_at).getTime() > now.getTime();
      return {
        userId: r.id,
        player: r.username ?? r.id,
        state: live ? 'active' : 'LAPSED — awaiting sweep',
        rail: r.stripe_customer_id ? 'Stripe (web)' : 'Store (App Store / Play)',
        expires: r.pro_expires_at ? fmtTime(r.pro_expires_at) : 'no expiry',
        member: fmtTime(r.created_at),
      };
    });
    const live = rows.filter((r) => r.state === 'active').length;
    return ok(
      'Pro subscribers',
      `${live} active${rows.length - live ? `, ${rows.length - live} lapsed but still flagged is_pro (the hourly sweep demotes these)` : ''}`,
      [
        { key: 'player', label: 'Player' },
        { key: 'state', label: 'State' },
        { key: 'rail', label: 'Billing rail' },
        { key: 'expires', label: 'Expires' },
        { key: 'member', label: 'Member since' },
      ],
      rows,
    );
  }

  if (metric === 'signups') {
    const since = iso(new Date(now.getTime() - 7 * 86400000));
    const [{ data: profs }, usersRes] = await Promise.all([
      admin.from('profiles').select('*').gte('created_at', since).order('created_at', { ascending: false }),
      admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);
    const authById = new Map((usersRes.data?.users ?? []).map((u) => [u.id, u]));
    const rows = (profs ?? []).map((r) => {
      const u = authById.get(r.id as string);
      return {
        userId: r.id,
        player: r.username ?? r.id,
        email: u?.email ?? '—',
        provider: (u?.app_metadata?.providers ?? [u?.app_metadata?.provider].filter(Boolean)).join(', ') || '—',
        guest: r.converted_from_guest ? 'yes' : 'no',
        joined: fmtTime(r.created_at as string),
      };
    });
    return ok('Signups — last 7 days', `${rows.length} new account${rows.length === 1 ? '' : 's'}`, [
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'provider', label: 'Provider' },
      { key: 'guest', label: 'From guest' },
      { key: 'joined', label: 'Joined' },
    ], rows);
  }

  if (metric === 'reports') {
    const { data } = await admin
      .from('reports')
      .select('reporter_id, reported_user_id, reason, context, created_at')
      .gte('created_at', iso(new Date(now.getTime() - 30 * 86400000)))
      .order('created_at', { ascending: false });
    const names = await nameOf((data ?? []).flatMap((r) => [r.reporter_id, r.reported_user_id]));
    const rows = (data ?? []).map((r) => ({
      userId: r.reported_user_id,
      player: names.get(r.reported_user_id) ?? r.reported_user_id,
      reporter: names.get(r.reporter_id) ?? r.reporter_id,
      reason: r.reason || '—',
      context: r.context || '—',
      when: fmtTime(r.created_at),
    }));
    return ok('Reports — last 30 days', `${rows.length} report${rows.length === 1 ? '' : 's'} filed`, [
      { key: 'player', label: 'Reported' },
      { key: 'reporter', label: 'Reporter' },
      { key: 'reason', label: 'Reason' },
      { key: 'context', label: 'Context' },
      { key: 'when', label: 'When' },
    ], rows);
  }

  if (metric === 'cohort' && day) {
    // Everyone whose FIRST recorded day is `day`, with the return days that
    // produced the D1/D7/D30 percentages on the summary table.
    const { data } = await admin.from('daily_results').select('user_id, day');
    const first = new Map<string, string>();
    const active = new Map<string, Set<string>>();
    for (const r of data ?? []) {
      const d = String(r.day).slice(0, 10);
      if (!first.has(r.user_id) || d < first.get(r.user_id)!) first.set(r.user_id, d);
      if (!active.has(r.user_id)) active.set(r.user_id, new Set());
      active.get(r.user_id)!.add(d);
    }
    const plus = (k: string, n: number) => {
      const [y, m, dd] = k.split('-').map(Number);
      return iso(new Date(Date.UTC(y, m - 1, dd + n))).slice(0, 10);
    };
    const members = [...first.entries()].filter(([, c]) => c === day).map(([id]) => id);
    const names = await nameOf(members);
    const rows = members.map((id) => {
      const days = active.get(id)!;
      return {
        userId: id,
        player: names.get(id) ?? id,
        d1: days.has(plus(day, 1)) ? 'yes' : 'no',
        d7: days.has(plus(day, 7)) ? 'yes' : 'no',
        d30: days.has(plus(day, 30)) ? 'yes' : 'no',
        activeDays: days.size,
        lastSeen: [...days].sort().pop() ?? day,
      };
    });
    return ok(`Cohort — first played ${day}`, `${rows.length} player${rows.length === 1 ? '' : 's'}`, [
      { key: 'player', label: 'Player' },
      { key: 'd1', label: 'Returned D1' },
      { key: 'd7', label: 'Returned D7' },
      { key: 'd30', label: 'Returned D30' },
      { key: 'activeDays', label: 'Total days played' },
      { key: 'lastSeen', label: 'Last played' },
    ], rows);
  }

  if (metric === 'provider' && key) {
    const usersRes = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const matching = (usersRes.data?.users ?? []).filter((u) =>
      (u.app_metadata?.providers ?? [u.app_metadata?.provider].filter(Boolean)).includes(key),
    );
    const names = await nameOf(matching.map((u) => u.id));
    const rows = matching.map((u) => ({
      userId: u.id,
      player: names.get(u.id) ?? u.id,
      email: u.email ?? '—',
      confirmed: u.email_confirmed_at ? 'yes' : 'no',
      lastSignIn: u.last_sign_in_at ? fmtTime(u.last_sign_in_at) : '—',
      joined: fmtTime(u.created_at),
    }));
    return ok(`Sign-in provider — ${key}`, `${rows.length} account${rows.length === 1 ? '' : 's'}`, [
      { key: 'player', label: 'Player' },
      { key: 'email', label: 'Email' },
      { key: 'confirmed', label: 'Email confirmed' },
      { key: 'lastSignIn', label: 'Last sign-in' },
      { key: 'joined', label: 'Joined' },
    ], rows);
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────
  if (metric === 'users' || metric === 'banned') {
    let q = admin
      .from('profiles')
      .select('id, username, level, xp, is_pro, is_banned, ban_reason, last_played_at, created_at, app_version, app_platform')
      .order('created_at', { ascending: false })
      .limit(500);
    if (metric === 'banned') q = q.eq('is_banned', true);
    const { data } = await q;
    const rows = (data ?? []).map((r) => ({
      userId: r.id,
      player: r.username ?? r.id,
      level: r.level ?? 0,
      pro: r.is_pro ? 'yes' : 'no',
      build: r.app_version ? `${r.app_version} (${r.app_platform ?? '?'})` : '—',
      lastPlayed: r.last_played_at ? fmtTime(r.last_played_at) : 'never',
      joined: fmtTime(r.created_at),
      ...(metric === 'banned' ? { reason: r.ban_reason || '—' } : {}),
    }));
    return ok(
      metric === 'banned' ? 'Banned accounts' : 'All accounts',
      `${rows.length} account${rows.length === 1 ? '' : 's'}`,
      [
        { key: 'player', label: 'Player' },
        ...(metric === 'banned' ? [{ key: 'reason', label: 'Reason' }] : []),
        { key: 'level', label: 'Level' },
        { key: 'pro', label: 'Pro' },
        { key: 'build', label: 'Build' },
        { key: 'lastPlayed', label: 'Last played' },
        { key: 'joined', label: 'Joined' },
      ],
      rows,
    );
  }

  // ── Puzzles: plays for a mode, optionally on one day ──────────────────────
  if (metric === 'plays') {
    const since = day ?? iso(new Date(now.getTime() - 14 * 86400000)).slice(0, 10);
    let q = admin
      .from('daily_results')
      .select('user_id, day, game_mode, play_type, completed, guess_count, time_seconds, boards_solved, total_boards, composite_score')
      .order('composite_score', { ascending: false })
      .limit(300);
    q = day ? q.eq('day', day) : q.gte('day', since);
    if (key) q = q.eq('game_mode', key);
    const { data } = await q;
    const names = await nameOf((data ?? []).map((r) => r.user_id));
    const rows = (data ?? []).map((r) => ({
      userId: r.user_id,
      player: names.get(r.user_id) ?? r.user_id,
      day: String(r.day).slice(0, 10),
      mode: r.game_mode,
      result: r.completed ? 'win' : 'loss',
      guesses: r.guess_count,
      boards: `${r.boards_solved}/${r.total_boards}`,
      time: `${r.time_seconds}s`,
      score: r.composite_score,
    }));
    const won = rows.filter((r) => r.result === 'win').length;
    return ok(
      day && key ? `${key} — ${day}` : key ? `${key} — last 14 days` : 'Daily results — last 14 days',
      `${rows.length} play${rows.length === 1 ? '' : 's'}, ${won} won (${rows.length ? Math.round((1000 * won) / rows.length) / 10 : 0}%)`,
      [
        { key: 'player', label: 'Player' },
        { key: 'day', label: 'Day' },
        { key: 'mode', label: 'Mode' },
        { key: 'result', label: 'Result' },
        { key: 'guesses', label: 'Guesses' },
        { key: 'boards', label: 'Boards' },
        { key: 'time', label: 'Time' },
        { key: 'score', label: 'Score' },
      ],
      rows,
    );
  }

  // ── Puzzles: streak buckets and shield holders ────────────────────────────
  if (metric === 'streaks' || metric === 'shields') {
    const BOUNDS: Record<string, [number, number]> = {
      '0': [0, 0], '1-2': [1, 2], '3-6': [3, 6], '7-13': [7, 13], '14-29': [14, 29], '30+': [30, Number.MAX_SAFE_INTEGER],
    };
    const { data } = await admin
      .from('profiles')
      .select('id, username, daily_login_streak, best_daily_login_streak, streak_shields, is_pro, last_played_at')
      .order('daily_login_streak', { ascending: false });
    let list = data ?? [];
    if (metric === 'shields') list = list.filter((r) => (r.streak_shields ?? 0) > 0);
    else if (key && BOUNDS[key]) {
      const [lo, hi] = BOUNDS[key];
      list = list.filter((r) => (r.daily_login_streak ?? 0) >= lo && (r.daily_login_streak ?? 0) <= hi);
    }
    const rows = list.map((r) => ({
      userId: r.id,
      player: r.username ?? r.id,
      streak: r.daily_login_streak ?? 0,
      best: r.best_daily_login_streak ?? 0,
      shields: r.streak_shields ?? 0,
      pro: r.is_pro ? 'yes' : 'no',
      lastPlayed: r.last_played_at ? fmtTime(r.last_played_at) : 'never',
    }));
    return ok(
      metric === 'shields' ? 'Players holding streak shields' : `Streak bucket — ${key ?? 'all'} days`,
      `${rows.length} player${rows.length === 1 ? '' : 's'}`,
      [
        { key: 'player', label: 'Player' },
        { key: 'streak', label: 'Current streak' },
        { key: 'best', label: 'Best ever' },
        { key: 'shields', label: 'Shields' },
        { key: 'pro', label: 'Pro' },
        { key: 'lastPlayed', label: 'Last played' },
      ],
      rows,
    );
  }

  // ── Ops: VS matches ───────────────────────────────────────────────────────
  if (metric === 'matches') {
    const { data } = await admin
      .from('matches')
      .select('id, game_mode, player1_id, player2_id, winner_id, player1_score, player2_score, forfeit, started_at, completed_at, created_at')
      .gte('created_at', iso(new Date(now.getTime() - 14 * 86400000)))
      .order('created_at', { ascending: false })
      .limit(300);
    let list = data ?? [];
    if (key === 'completed') list = list.filter((m) => m.completed_at);
    if (key === 'abandoned') list = list.filter((m) => !m.completed_at);
    if (key === 'forfeit') list = list.filter((m) => m.forfeit);
    const names = await nameOf(list.flatMap((m) => [m.player1_id, m.player2_id, m.winner_id]));
    const rows = list.map((m) => ({
      userId: m.player1_id,
      player1: names.get(m.player1_id) ?? m.player1_id,
      player2: m.player2_id ? names.get(m.player2_id) ?? m.player2_id : 'solo',
      mode: m.game_mode,
      winner: m.winner_id ? names.get(m.winner_id) ?? m.winner_id : m.completed_at ? 'draw' : 'unfinished',
      score: `${m.player1_score ?? 0} – ${m.player2_score ?? 0}`,
      duration: m.completed_at
        ? `${Math.max(0, Math.round((new Date(m.completed_at).getTime() - new Date(m.started_at).getTime()) / 1000))}s`
        : '—',
      forfeit: m.forfeit ? 'yes' : 'no',
      when: fmtTime(m.created_at),
    }));
    return ok(
      key ? `VS matches — ${key}` : 'VS matches — last 14 days',
      `${rows.length} match${rows.length === 1 ? '' : 'es'}`,
      [
        { key: 'player1', label: 'Player 1' },
        { key: 'player2', label: 'Player 2' },
        { key: 'mode', label: 'Mode' },
        { key: 'winner', label: 'Winner' },
        { key: 'score', label: 'Score' },
        { key: 'duration', label: 'Duration' },
        { key: 'forfeit', label: 'Forfeit' },
        { key: 'when', label: 'When' },
      ],
      rows,
    );
  }

  // ── Ops: webhook events, optionally one day ───────────────────────────────
  if (metric === 'webhooks') {
    let q = admin.from('store_webhook_events').select('event_id, source, processed_at').order('processed_at', { ascending: false }).limit(300);
    if (day) q = q.gte('processed_at', dayStart(day)).lte('processed_at', dayEnd(day));
    const { data } = await q;
    const rows = (data ?? []).map((e) => ({
      event: e.event_id,
      source: e.source,
      when: fmtTime(e.processed_at),
    }));
    return ok(day ? `Store webhooks — ${day}` : 'Store webhooks', `${rows.length} processed event${rows.length === 1 ? '' : 's'}`, [
      { key: 'event', label: 'Event id' },
      { key: 'source', label: 'Source' },
      { key: 'when', label: 'Processed' },
    ], rows);
  }

  // ── Payments / Referrals: invites by status ───────────────────────────────
  if (metric === 'referrals') {
    let q = admin
      .from('referrals')
      .select('code, status, inviter_id, invitee_id, created_at, redeemed_at, converted_at, converted_plan, reward_granted_at, expires_at')
      .order('created_at', { ascending: false })
      .limit(300);
    if (key === 'awaiting') q = q.eq('status', 'redeemed').is('reward_granted_at', null);
    else if (key) q = q.eq('status', key);
    const { data } = await q;
    const names = await nameOf((data ?? []).flatMap((r) => [r.inviter_id, r.invitee_id].filter(Boolean) as string[]));
    const rows = (data ?? []).map((r) => ({
      userId: r.inviter_id,
      inviter: names.get(r.inviter_id) ?? r.inviter_id,
      invitee: r.invitee_id ? names.get(r.invitee_id) ?? r.invitee_id : '—',
      code: r.code,
      status: r.status,
      plan: r.converted_plan ?? '—',
      rewarded: r.reward_granted_at ? fmtTime(r.reward_granted_at) : '—',
      created: fmtTime(r.created_at),
    }));
    return ok(`Referrals${key ? ` — ${key}` : ''}`, `${rows.length} invite${rows.length === 1 ? '' : 's'}`, [
      { key: 'inviter', label: 'Inviter' },
      { key: 'invitee', label: 'Friend' },
      { key: 'code', label: 'Code' },
      { key: 'status', label: 'Status' },
      { key: 'plan', label: 'Plan' },
      { key: 'rewarded', label: 'Reward granted' },
      { key: 'created', label: 'Created' },
    ], rows);
  }

  // ── Payments: Pro expiring within N days ──────────────────────────────────
  if (metric === 'expiring') {
    const horizon = iso(new Date(now.getTime() + 7 * 86400000));
    const { data } = await admin
      .from('profiles')
      .select('id, username, pro_expires_at, stripe_customer_id, stripe_subscription_id')
      .eq('is_pro', true)
      .not('pro_expires_at', 'is', null)
      .lte('pro_expires_at', horizon)
      .order('pro_expires_at', { ascending: true });
    const rows = (data ?? []).map((r) => ({
      userId: r.id,
      player: r.username ?? r.id,
      expires: fmtTime(r.pro_expires_at as string),
      rail: r.stripe_customer_id ? 'Stripe (web)' : 'Store',
      subscription: r.stripe_subscription_id ?? '—',
    }));
    return ok('Pro expiring within 7 days', `${rows.length} account${rows.length === 1 ? '' : 's'}`, [
      { key: 'player', label: 'Player' },
      { key: 'expires', label: 'Expires' },
      { key: 'rail', label: 'Rail' },
      { key: 'subscription', label: 'Subscription' },
    ], rows);
  }

  return NextResponse.json({ error: `Unknown metric "${metric}"` }, { status: 400 });
}
