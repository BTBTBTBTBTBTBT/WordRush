// Pure aggregation for the admin portal's newer pages (Achievements, Avatars,
// VS & Bots, Friends, Onboarding, Today's dailies, Seasons). No Supabase
// imports, so vitest's node environment exercises it directly; each
// api/admin/* route fetches its rows (service role, verifyAdmin-gated) and
// hands them here. Admin-only: nothing in the consumer app imports this file.

import { validateAvatar, defaultAvatar, currentSeason, type AvatarConfig } from '@wordle-duel/core';

export interface Tally { key: string; count: number }

/** Count rows by a key, most common first (ties alphabetical). Null/empty keys are skipped. */
export function tallyBy<T>(rows: readonly T[], keyOf: (r: T) => string | null | undefined): Tally[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    if (k == null || k === '') continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

/** n / d as a 0–100 percentage with one decimal; 0 when d is 0. */
export function pct(n: number, d: number): number {
  return d > 0 ? Math.round((1000 * n) / d) / 10 : 0;
}

// ── Avatars (the mascot maker, FINISH_SPEC AN) ──────────────────────────────

export interface AvatarProfileRow {
  avatar_config: unknown;
  avatar_url?: string | null;
  avatar_cast_id?: string | null;
  avatar_frame?: string | null;
}

/** The avatar_config parts the admin page tallies, in builder-tab order. */
export const AVATAR_PARTS = ['body', 'color', 'pattern', 'eyes', 'mouth', 'nose', 'head', 'face', 'neck', 'bg', 'frame'] as const;
export type AvatarPart = (typeof AVATAR_PARTS)[number];

export interface AvatarAdoption {
  /** Profiles with a saved avatar_config. */
  saved: number;
  /** Of those, which one shows: the mascot or the photo. */
  display: { mascot: number; photo: number };
  /** Saved a mascot AND have a photo on file (the photo-vs-mascot choice applies). */
  withPhoto: number;
  /** Of `withPhoto`, how many picked the mascot over their photo. */
  photoOwnersShowingMascot: number;
  /** Mascots wearing at least one accessory (hat, face extra or neck extra). */
  accessorized: number;
  /** Popular choices per part. */
  parts: Record<AvatarPart, Tally[]>;
  /** avatar_cast_id (a cast preset as the avatar) popularity. */
  castPicks: Tally[];
  /** The profiles.avatar_frame column (the level / Pro frame shown around any avatar). */
  frames: Tally[];
}

/**
 * Adoption + popularity from profile rows that carry avatar_config. Configs
 * are read through core validateAvatar so a malformed row counts as the
 * default instead of polluting the tallies with junk keys.
 */
export function avatarAdoption(rows: readonly AvatarProfileRow[]): AvatarAdoption {
  const saved = rows.filter((r) => r.avatar_config != null && typeof r.avatar_config === 'object');
  const configs: Array<{ row: AvatarProfileRow; c: AvatarConfig }> = saved.map((row) => ({
    row,
    // Same fallback the clients use: a missing `display` means 'photo' for a player with a photo.
    c: validateAvatar(row.avatar_config, defaultAvatar('', null, !!row.avatar_url)),
  }));
  const display = { mascot: 0, photo: 0 };
  let withPhoto = 0;
  let photoOwnersShowingMascot = 0;
  let accessorized = 0;
  for (const { row, c } of configs) {
    display[c.display === 'photo' ? 'photo' : 'mascot']++;
    if (row.avatar_url) {
      withPhoto++;
      if (c.display === 'mascot') photoOwnersShowingMascot++;
    }
    if (c.head !== 'none' || c.face !== 'none' || c.neck !== 'none') accessorized++;
  }
  const parts = Object.fromEntries(
    AVATAR_PARTS.map((p) => [p, tallyBy(configs, ({ c }) => String(c[p as keyof AvatarConfig] ?? ''))]),
  ) as Record<AvatarPart, Tally[]>;
  return {
    saved: configs.length,
    display,
    withPhoto,
    photoOwnersShowingMascot,
    accessorized,
    parts,
    castPicks: tallyBy(rows, (r) => r.avatar_cast_id ?? null),
    frames: tallyBy(rows, (r) => r.avatar_frame ?? null),
  };
}

// ── Today's dailies (content health) ────────────────────────────────────────

export interface DailyRow { user_id: string; game_mode: string; completed: boolean | null }

export interface GroupHealth {
  /** Per-mode solo plays + wins for the day, in the order given. */
  perMode: Array<{ mode: string; plays: number; wins: number }>;
  /** Distinct players with at least one game in the group. */
  players: number;
  /** Players who finished every game in the group (a sweep). */
  sweeps: number;
  /** Players who won every game in the group (a flawless). */
  flawless: number;
}

/**
 * One home-banner row's health for a day (core groupTier semantics: a sweep is
 * every game in the row finished, a flawless is every game won). `rows` should
 * be solo daily_results for one player-local day.
 */
export function groupHealth(rows: readonly DailyRow[], modes: readonly string[]): GroupHealth {
  const inGroup = new Set(modes);
  const perMode = new Map(modes.map((m) => [m, { mode: m, plays: 0, wins: 0 }]));
  const byUser = new Map<string, { played: Set<string>; won: Set<string> }>();
  for (const r of rows) {
    if (!inGroup.has(r.game_mode)) continue;
    const pm = perMode.get(r.game_mode)!;
    pm.plays++;
    if (r.completed) pm.wins++;
    const u = byUser.get(r.user_id) ?? { played: new Set<string>(), won: new Set<string>() };
    u.played.add(r.game_mode);
    if (r.completed) u.won.add(r.game_mode);
    byUser.set(r.user_id, u);
  }
  let sweeps = 0;
  let flawless = 0;
  if (modes.length > 0) {
    for (const u of byUser.values()) {
      if (u.played.size >= modes.length) sweeps++;
      if (u.won.size >= modes.length) flawless++;
    }
  }
  return { perMode: [...perMode.values()], players: byUser.size, sweeps, flawless };
}

// ── Pocket games (friendly_games) ───────────────────────────────────────────

export interface FriendlyGameRow { kind: string; status: string; created_at: string; winner: string | null }

export interface PocketKindSummary { kind: string; total: number; active: number; done: number; resigned: number; expired: number; last7: number; decided: number }

/** Per-kind status breakdown for the pocket games, in the order given (unknown kinds appended). */
export function pocketSummary(rows: readonly FriendlyGameRow[], kinds: readonly string[], nowMs: number): PocketKindSummary[] {
  const weekAgo = nowMs - 7 * 86400000;
  const out = new Map<string, PocketKindSummary>(
    kinds.map((k) => [k, { kind: k, total: 0, active: 0, done: 0, resigned: 0, expired: 0, last7: 0, decided: 0 }]),
  );
  for (const r of rows) {
    const s = out.get(r.kind) ?? { kind: r.kind, total: 0, active: 0, done: 0, resigned: 0, expired: 0, last7: 0, decided: 0 };
    s.total++;
    if (r.status === 'active' || r.status === 'done' || r.status === 'resigned' || r.status === 'expired') s[r.status]++;
    if (r.winner) s.decided++;
    if (Date.parse(r.created_at) >= weekAgo) s.last7++;
    out.set(r.kind, s);
  }
  return [...out.values()];
}

// ── Onboarding / activation (field-based proxy) ─────────────────────────────

export interface SignupRow { id: string; created_at: string; avatar_config: unknown }

export interface FunnelStep { label: string; count: number; pct: number }

/**
 * New-player activation from fields that already exist (the first-run tour's
 * own `onboarded-v2` flag lives in localStorage, so the tour steps themselves
 * are NOT tracked): signed up → saved a mascot → played a daily → came back on
 * a second day → added a friend.
 */
export function activationFunnel(
  signups: readonly SignupRow[],
  playDays: ReadonlyMap<string, ReadonlySet<string>>,
  withFriend: ReadonlySet<string>,
): FunnelStep[] {
  const n = signups.length;
  const mascot = signups.filter((s) => s.avatar_config != null).length;
  const played = signups.filter((s) => (playDays.get(s.id)?.size ?? 0) >= 1).length;
  const returned = signups.filter((s) => (playDays.get(s.id)?.size ?? 0) >= 2).length;
  const friended = signups.filter((s) => withFriend.has(s.id)).length;
  return [
    { label: 'Signed up', count: n, pct: n ? 100 : 0 },
    { label: 'Saved a mascot', count: mascot, pct: pct(mascot, n) },
    { label: 'Played a daily', count: played, pct: pct(played, n) },
    { label: 'Played on 2+ days', count: returned, pct: pct(returned, n) },
    { label: 'Added a friend', count: friended, pct: pct(friended, n) },
  ];
}

// ── Seasons ─────────────────────────────────────────────────────────────────

export interface SeasonStatus {
  /** The season on this date (core currentSeason), or null. */
  active: string | null;
  /** This year's (or next year's, once past) Halloween window, YYYY-MM-DD inclusive. */
  start: string;
  end: string;
  /** Whole days until the window opens (0 while it's on). */
  daysUntilStart: number;
  /** Whole days left including today while it's on, else 0. */
  daysLeft: number;
}

const ymd = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dayNum = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
};

/** The Halloween window (Oct 24 – Nov 1, core currentSeason) relative to a YYYY-MM-DD day. */
export function halloweenStatus(day: string): SeasonStatus {
  const y = Number(day.slice(0, 4));
  const active = currentSeason(day);
  // Both ends fall in the same calendar year; once Nov 1 has passed, the next window is next year's.
  const startYear = day.slice(5) > '11-01' ? y + 1 : y;
  const start = ymd(startYear, 10, 24);
  const end = ymd(startYear, 11, 1);
  const today = dayNum(day);
  return {
    active,
    start,
    end,
    daysUntilStart: active ? 0 : Math.max(0, dayNum(start) - today),
    daysLeft: active ? dayNum(end) - today + 1 : 0,
  };
}
