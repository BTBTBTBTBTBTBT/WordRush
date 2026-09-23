// Pure aggregation for the admin Marketing page's "Shares" section (JP,
// 2026-09-23: "show where the 59 shares came from and what the outcome was").
// No Supabase imports so vitest's node environment can exercise it directly;
// api/admin/marketing/route.ts fetches the rows and hands them here.
//
// PROVENANCE comes from public.share_events — one row per Share-button tap
// with platform (web|ios|android), kind (text|image|link_invite|other),
// game_mode and surface (post_game, leaderboard, referral, invite_sheet, …).
//
// OUTCOMES are stitched from what the DB can actually attribute:
//   * link_invite shares → public.referrals (created / redeemed / converted,
//     each by its own timestamp inside the window — the same statuses the
//     Referrals admin page counts: "redeemed" includes rows that went on to
//     convert) plus /join page opens from public.landing_visits.
//   * text/image shares → /s/ share-page visits from public.landing_visits
//     and brand-new accounts stamped profiles.signup_source = 'share' (the
//     share page drops the same first-touch wr_src cookie the /go links do).
// landing_visits ships with this change, so opens/visits are null (not 0)
// until the manual migration is applied and the deploy has been live.

export interface ShareEventRow {
  platform: string;
  kind: string;
  game_mode: string | null;
  surface: string | null;
}

export interface BreakdownRow {
  label: string;
  count: number;
  /** Share of the window total, one decimal, 0 when there are no rows. */
  pct: number;
}

export interface PlatformKindRow extends BreakdownRow {
  platform: string;
  kind: string;
}

export interface ShareBreakdown {
  total: number;
  byKind: BreakdownRow[];
  byPlatformKind: PlatformKindRow[];
  byMode: BreakdownRow[];
  bySurface: BreakdownRow[];
}

/** Empty game_mode/surface strings (the referral share logs mode '') read as this. */
export const UNLABELED = '(none)';

/** profiles.signup_source value stamped after a /s/ share-page visit (lib/landing-visits.ts). */
export const SHARE_SOURCE = 'share';

function pct(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function tally<T>(rows: T[], keyOf: (r: T) => string): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/** Count desc, then label asc — deterministic for tests and stable on screen. */
function toRows(m: Map<string, number>, total: number): BreakdownRow[] {
  return [...m.entries()]
    .map(([label, count]) => ({ label, count, pct: pct(count, total) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

const label = (s: string | null | undefined) => (s && s.trim() ? s.trim() : UNLABELED);

export function summarizeShares(rows: ShareEventRow[]): ShareBreakdown {
  const total = rows.length;
  const byPK = tally(rows, (r) => `${r.platform}\u0000${r.kind}`);
  const byPlatformKind: PlatformKindRow[] = [...byPK.entries()]
    .map(([k, count]) => {
      const [platform, kind] = k.split('\u0000');
      return { platform, kind, label: `${platform} · ${kind}`, count, pct: pct(count, total) };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  return {
    total,
    byKind: toRows(tally(rows, (r) => r.kind), total),
    byPlatformKind,
    byMode: toRows(tally(rows, (r) => label(r.game_mode)), total),
    bySurface: toRows(tally(rows, (r) => label(r.surface)), total),
  };
}

export interface ReferralRow {
  code: string;
  status: string;
  created_at: string;
  redeemed_at: string | null;
  converted_at: string | null;
}

export interface LandingVisitRow {
  page: string; // 'share' | 'join'
  ref: string;  // share: game mode; join: referral code
  created_at: string;
}

export interface InviteOutcomes {
  /** link_invite share taps in the window (all surfaces: referral + VS invites). */
  shared: number;
  /** link_invite taps from the referral panel specifically — the ones /join can answer for. */
  sharedReferral: number;
  /** Referral codes created in the window. */
  created: number;
  /** /join page opens in the window — null until landing_visits exists. */
  opens: number | null;
  /** Distinct codes opened in the window — null until landing_visits exists. */
  codesOpened: number | null;
  /** Redemptions whose redeemed_at falls in the window (status redeemed OR converted). */
  redeemed: number;
  /** Conversions whose converted_at falls in the window. */
  converted: number;
}

export interface ResultShareOutcomes {
  /** text + image share taps in the window. */
  shared: number;
  /** /s/ share-page visits in the window — null until landing_visits exists. */
  landingVisits: number | null;
  /** Share-page visits by game mode (top first) — empty until landing_visits exists. */
  landingVisitsByMode: BreakdownRow[];
  /** Brand-new accounts stamped signup_source='share' in the window — null if unknown. */
  signups: number | null;
}

export interface ShareOutcomes {
  invites: InviteOutcomes;
  results: ResultShareOutcomes;
}

const inWindow = (iso: string | null | undefined, sinceMs: number) =>
  !!iso && new Date(iso).getTime() >= sinceMs;

const REDEEMED_STATUSES = new Set(['redeemed', 'converted']);

export function summarizeShareOutcomes(input: {
  shares: ShareEventRow[];
  referrals: ReferralRow[];
  /** null = landing_visits table not applied / unreadable. */
  visits: LandingVisitRow[] | null;
  /** null = profiles.signup_source count unavailable. */
  shareSignups: number | null;
  since: Date;
}): ShareOutcomes {
  const sinceMs = input.since.getTime();
  const links = input.shares.filter((s) => s.kind === 'link_invite');
  const joinVisits = input.visits?.filter((v) => v.page === 'join' && inWindow(v.created_at, sinceMs)) ?? null;
  const shareVisits = input.visits?.filter((v) => v.page === 'share' && inWindow(v.created_at, sinceMs)) ?? null;

  return {
    invites: {
      shared: links.length,
      sharedReferral: links.filter((s) => (s.surface ?? '') === 'referral').length,
      created: input.referrals.filter((r) => inWindow(r.created_at, sinceMs)).length,
      opens: joinVisits ? joinVisits.length : null,
      codesOpened: joinVisits ? new Set(joinVisits.map((v) => v.ref)).size : null,
      redeemed: input.referrals.filter(
        (r) => REDEEMED_STATUSES.has(r.status) && inWindow(r.redeemed_at, sinceMs),
      ).length,
      converted: input.referrals.filter(
        (r) => r.status === 'converted' && inWindow(r.converted_at, sinceMs),
      ).length,
    },
    results: {
      shared: input.shares.filter((s) => s.kind === 'text' || s.kind === 'image').length,
      landingVisits: shareVisits ? shareVisits.length : null,
      landingVisitsByMode: shareVisits
        ? toRows(tally(shareVisits, (v) => label(v.ref)), shareVisits.length)
        : [],
      signups: input.shareSignups,
    },
  };
}
