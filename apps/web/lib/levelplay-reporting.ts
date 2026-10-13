// ============================================================
// Unity LevelPlay (ironSource) Reporting API, server-side only
// ============================================================
// Confirmed against Unity's docs (2026-10-13):
//   Auth       https://docs.unity.com/en-us/grow/is-ads/monetization/apis/authentication
//              GET https://platform.ironsrc.com/partners/publisher/auth with headers
//              `secretkey` and `refreshToken`; the body is the Bearer token (possibly
//              wrapped in double quotes, which we strip). Valid 24 hours.
//   Reporting  https://docs.unity.com/en-us/grow/is-ads/monetization/apis/reporting
//              GET https://platform.ironsrc.com/levelPlay/reporting/v1 (Bearer)
//              The older `mediation/applications/v6/stats` endpoint was deprecated on
//              2025-08-15, so it is NOT used. v1 has no `adUnits` breakdown: the ad
//              unit split is `adFormat` (interstitial / rewarded), and there is no
//              `fillRate` metric: fill comes from `appFills` / `appRequests`.
//
// Credentials (Vercel env, never sent to a client): LEVELPLAY_SECRET_KEY and
// LEVELPLAY_REFRESH_TOKEN. Nothing here throws to the caller: the result is a
// typed union of not-connected / error / ok.

export const LEVELPLAY_AUTH_URL = 'https://platform.ironsrc.com/partners/publisher/auth';
export const LEVELPLAY_REPORT_URL = 'https://platform.ironsrc.com/levelPlay/reporting/v1';
/** The two LevelPlay app keys (iOS, Android). Keys are public identifiers, not secrets. */
export const LEVELPLAY_APP_KEYS = ['28b3f4525', '28b3fb835'] as const;
export const LEVELPLAY_ENV_VARS = ['LEVELPLAY_SECRET_KEY', 'LEVELPLAY_REFRESH_TOKEN'] as const;
export type LevelPlayEnvVar = (typeof LEVELPLAY_ENV_VARS)[number];

export const REPORT_METRICS = ['revenue', 'impressions', 'appRequests', 'appFills'] as const;
export const REPORT_BREAKDOWNS = ['date', 'platform', 'adFormat'] as const;

// ── Types ────────────────────────────────────────────────────

export interface LevelPlayRow {
  date: string; // YYYY-MM-DD
  platform: 'ios' | 'android' | 'other';
  adFormat: 'interstitial' | 'rewarded' | 'other';
  revenue: number;
  impressions: number;
  requests: number;
  fills: number;
}

export interface AdTotals {
  revenue: number;
  impressions: number;
  /** Revenue per 1,000 impressions; null when there are no impressions. */
  ecpm: number | null;
  /** Fills / requests, 0..1; null when the API reported no requests. */
  fillRate: number | null;
}

export interface AdWindow {
  days: number;
  total: AdTotals;
  byPlatform: { ios: AdTotals; android: AdTotals };
  byAdFormat: { interstitial: AdTotals; rewarded: AdTotals };
}

export interface LevelPlaySummary {
  /** Last date (UTC) with data in the report, or null when the report was empty. */
  throughDate: string | null;
  last7: AdWindow;
  last30: AdWindow;
  /** Daily revenue, oldest first, one point for each of the last 30 days (zeros included). */
  daily: { date: string; revenue: number }[];
}

export type LevelPlayResult =
  | { status: 'not_connected'; missing: LevelPlayEnvVar[] }
  | { status: 'error'; error: string }
  | { status: 'ok'; summary: LevelPlaySummary };

// ── Pure mapping + aggregation (unit-tested) ─────────────────

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? Number(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

/** Normalize one raw API object. Returns null when it has no usable date. */
export function mapRow(raw: unknown): LevelPlayRow | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const date = typeof r.date === 'string' ? r.date.slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const platformRaw = String(r.platform ?? '').toLowerCase();
  const formatRaw = String(r.adFormat ?? '').toLowerCase();
  return {
    date,
    platform: platformRaw === 'ios' ? 'ios' : platformRaw === 'android' ? 'android' : 'other',
    adFormat: formatRaw === 'interstitial' ? 'interstitial' : formatRaw === 'rewarded' ? 'rewarded' : 'other',
    revenue: num(r.revenue),
    impressions: num(r.impressions),
    requests: num(r.appRequests),
    fills: num(r.appFills),
  };
}

export function mapRows(data: unknown): LevelPlayRow[] {
  if (!Array.isArray(data)) return [];
  return data.map(mapRow).filter((r): r is LevelPlayRow => r !== null);
}

export function totalsOf(rows: LevelPlayRow[]): AdTotals {
  let revenue = 0;
  let impressions = 0;
  let requests = 0;
  let fills = 0;
  for (const r of rows) {
    revenue += r.revenue;
    impressions += r.impressions;
    requests += r.requests;
    fills += r.fills;
  }
  return {
    revenue,
    impressions,
    ecpm: impressions > 0 ? (revenue / impressions) * 1000 : null,
    fillRate: requests > 0 ? Math.min(1, fills / requests) : null,
  };
}

const DAY_MS = 86_400_000;
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Inclusive list of the last `days` UTC dates ending at `end` (YYYY-MM-DD), oldest first. */
export function lastDays(end: string, days: number): string[] {
  const endMs = Date.parse(`${end}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => isoDay(endMs - (days - 1 - i) * DAY_MS));
}

function windowOf(rows: LevelPlayRow[], dates: Set<string>, days: number): AdWindow {
  const inWin = rows.filter((r) => dates.has(r.date));
  return {
    days,
    total: totalsOf(inWin),
    byPlatform: {
      ios: totalsOf(inWin.filter((r) => r.platform === 'ios')),
      android: totalsOf(inWin.filter((r) => r.platform === 'android')),
    },
    byAdFormat: {
      interstitial: totalsOf(inWin.filter((r) => r.adFormat === 'interstitial')),
      rewarded: totalsOf(inWin.filter((r) => r.adFormat === 'rewarded')),
    },
  };
}

/**
 * Roll rows up into the 7 and 30 day windows ending at `today` (UTC, inclusive;
 * today's partial day counts as it reports).
 */
export function summarize(rows: LevelPlayRow[], today: string): LevelPlaySummary {
  const days30 = lastDays(today, 30);
  const set30 = new Set(days30);
  const set7 = new Set(lastDays(today, 7));
  const byDay = new Map<string, number>();
  for (const r of rows) if (set30.has(r.date)) byDay.set(r.date, (byDay.get(r.date) ?? 0) + r.revenue);
  const dates = rows.filter((r) => set30.has(r.date)).map((r) => r.date).sort();
  return {
    throughDate: dates.length ? dates[dates.length - 1] : null,
    last7: windowOf(rows, set7, 7),
    last30: windowOf(rows, set30, 30),
    daily: days30.map((date) => ({ date, revenue: byDay.get(date) ?? 0 })),
  };
}

export function missingLevelPlayEnv(env: Record<string, string | undefined> = process.env): LevelPlayEnvVar[] {
  return LEVELPLAY_ENV_VARS.filter((k) => !env[k]?.trim());
}

/** The auth body may come back quoted (the docs' sample strips double quotes). */
export function parseBearer(body: string): string {
  return body.trim().replace(/^"+|"+$/g, '').trim();
}

export function buildReportUrl(startDate: string, endDate: string, page = 1): string {
  const qs = new URLSearchParams({
    startDate,
    endDate,
    appKey: LEVELPLAY_APP_KEYS.join(','),
    breakdowns: REPORT_BREAKDOWNS.join(','),
    metrics: REPORT_METRICS.join(','),
    resultsPerPage: '5000',
    page: String(page),
  });
  // URLSearchParams encodes commas as %2C, which the API decodes to the same list.
  return `${LEVELPLAY_REPORT_URL}?${qs}`;
}

// ── Network (server-only) ────────────────────────────────────

const TOKEN_TTL_MS = 55 * 60_000; // token lives 24h; refresh well inside any doubt
let cachedToken: { token: string; expiresAt: number; credKey: string } | null = null;

/** Test hook: clear the in-memory token cache. */
export function _resetLevelPlayTokenCache() {
  cachedToken = null;
}

async function getBearer(secretKey: string, refreshToken: string, fetchImpl: typeof fetch, now: number): Promise<string> {
  const credKey = `${secretKey.length}:${refreshToken.length}:${secretKey.slice(-4)}:${refreshToken.slice(-4)}`;
  if (cachedToken && cachedToken.credKey === credKey && cachedToken.expiresAt > now) return cachedToken.token;
  const res = await fetchImpl(LEVELPLAY_AUTH_URL, {
    headers: { secretkey: secretKey, refreshToken },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`LevelPlay auth: HTTP ${res.status} (check the secret key and refresh token)`);
  const token = parseBearer(await res.text());
  if (!token) throw new Error('LevelPlay auth returned an empty token');
  cachedToken = { token, expiresAt: now + TOKEN_TTL_MS, credKey };
  return token;
}

/**
 * Fetch the last 30 days of app-ad stats and summarize. Never throws.
 * `fetchImpl`/`now` are injectable for tests.
 */
export async function fetchLevelPlaySummary(
  opts: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; now?: number } = {},
): Promise<LevelPlayResult> {
  const env = opts.env ?? process.env;
  const missing = missingLevelPlayEnv(env);
  if (missing.length > 0) return { status: 'not_connected', missing };
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now();
  const today = isoDay(now);
  const start = lastDays(today, 30)[0];
  try {
    let token = await getBearer(env.LEVELPLAY_SECRET_KEY!.trim(), env.LEVELPLAY_REFRESH_TOKEN!.trim(), fetchImpl, now);
    const rows: LevelPlayRow[] = [];
    for (let page = 1; page <= 5; page++) {
      let res = await fetchImpl(buildReportUrl(start, today, page), {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401 && page === 1) {
        // Token revoked or expired early: drop the cache and retry once.
        cachedToken = null;
        token = await getBearer(env.LEVELPLAY_SECRET_KEY!.trim(), env.LEVELPLAY_REFRESH_TOKEN!.trim(), fetchImpl, now);
        res = await fetchImpl(buildReportUrl(start, today, page), {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
      }
      if (!res.ok) return { status: 'error', error: `LevelPlay reporting: HTTP ${res.status}` };
      const json = (await res.json()) as { data?: unknown; totalResults?: unknown; pageSize?: unknown };
      const pageRows = mapRows(json.data);
      rows.push(...pageRows);
      const total = num(json.totalResults);
      const got = Array.isArray(json.data) ? json.data.length : 0;
      if (got === 0 || rows.length >= total) break;
    }
    return { status: 'ok', summary: summarize(rows, today) };
  } catch (e) {
    return { status: 'error', error: e instanceof Error ? e.message : 'LevelPlay request failed' };
  }
}
