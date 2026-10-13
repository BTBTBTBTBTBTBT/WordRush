import { describe, it, expect, beforeEach } from 'vitest';
import {
  mapRow, mapRows, totalsOf, summarize, lastDays, missingLevelPlayEnv, parseBearer, buildReportUrl,
  fetchLevelPlaySummary, _resetLevelPlayTokenCache, LEVELPLAY_APP_KEYS,
} from './levelplay-reporting';

const row = (date: string, platform: string, adFormat: string, revenue: number, impressions: number, appRequests = 0, appFills = 0) =>
  ({ date, platform, adFormat, revenue, impressions, appRequests, appFills });

describe('mapping', () => {
  it('normalizes case, coerces strings, and drops rows without a date', () => {
    expect(mapRow(row('2026-10-12', 'iOS', 'Rewarded', 1.5, 10, 20, 10))).toEqual({
      date: '2026-10-12', platform: 'ios', adFormat: 'rewarded', revenue: 1.5, impressions: 10, requests: 20, fills: 10,
    });
    expect(mapRow({ date: '2026-10-12T00:00:00Z', platform: 'Android', adFormat: 'Interstitial', revenue: '2.25' })?.revenue).toBe(2.25);
    expect(mapRow({ platform: 'ios' })).toBeNull();
    expect(mapRow(null)).toBeNull();
    expect(mapRow(row('2026-10-12', 'web', 'banner', 1, 1))).toMatchObject({ platform: 'other', adFormat: 'other' });
    expect(mapRows('nope')).toEqual([]);
  });
});

describe('aggregation', () => {
  it('computes eCPM and fill from totals, not by averaging rows', () => {
    const t = totalsOf(mapRows([
      row('2026-10-12', 'ios', 'rewarded', 10, 1000, 100, 50),
      row('2026-10-12', 'android', 'rewarded', 2, 4000, 300, 300),
    ]));
    expect(t.revenue).toBe(12);
    expect(t.impressions).toBe(5000);
    expect(t.ecpm).toBeCloseTo(2.4);
    expect(t.fillRate).toBeCloseTo(350 / 400);
  });

  it('returns null eCPM/fill when there is nothing to divide by', () => {
    expect(totalsOf([])).toEqual({ revenue: 0, impressions: 0, ecpm: null, fillRate: null });
  });

  it('lists inclusive UTC days, oldest first', () => {
    expect(lastDays('2026-03-02', 3)).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('splits 7/30 day windows, platform and ad format, and fills sparkline gaps with zero', () => {
    const rows = mapRows([
      row('2026-10-13', 'ios', 'interstitial', 3, 300, 400, 300),
      row('2026-10-07', 'android', 'rewarded', 1, 100, 100, 100),
      row('2026-10-06', 'android', 'rewarded', 5, 500, 500, 250), // inside 30, outside 7
      row('2026-09-13', 'ios', 'rewarded', 99, 9, 9, 9), // 31 days back: outside the window
    ]);
    const s = summarize(rows, '2026-10-13');
    expect(s.last7.total.revenue).toBe(4);
    expect(s.last30.total.revenue).toBe(9);
    expect(s.last7.byPlatform.ios.revenue).toBe(3);
    expect(s.last30.byPlatform.android.revenue).toBe(6);
    expect(s.last30.byAdFormat.interstitial.revenue).toBe(3);
    expect(s.last30.byAdFormat.rewarded.revenue).toBe(6);
    expect(s.throughDate).toBe('2026-10-13');
    expect(s.daily).toHaveLength(30);
    expect(s.daily[29]).toEqual({ date: '2026-10-13', revenue: 3 });
    expect(s.daily[28].revenue).toBe(0);
    expect(summarize([], '2026-10-13').throughDate).toBeNull();
  });
});

describe('request building', () => {
  it('uses the v1 endpoint, both app keys, and the documented param names', () => {
    const u = new URL(buildReportUrl('2026-09-14', '2026-10-13'));
    expect(u.origin + u.pathname).toBe('https://platform.ironsrc.com/levelPlay/reporting/v1');
    expect(u.searchParams.get('appKey')).toBe(LEVELPLAY_APP_KEYS.join(','));
    expect(u.searchParams.get('breakdowns')).toBe('date,platform,adFormat');
    expect(u.searchParams.get('metrics')).toBe('revenue,impressions,appRequests,appFills');
    expect(u.searchParams.get('startDate')).toBe('2026-09-14');
  });
  it('strips quotes from the bearer body', () => {
    expect(parseBearer('"abc.def"\n')).toBe('abc.def');
  });
  it('names missing env vars', () => {
    expect(missingLevelPlayEnv({})).toEqual(['LEVELPLAY_SECRET_KEY', 'LEVELPLAY_REFRESH_TOKEN']);
    expect(missingLevelPlayEnv({ LEVELPLAY_SECRET_KEY: 'x', LEVELPLAY_REFRESH_TOKEN: ' ' })).toEqual(['LEVELPLAY_REFRESH_TOKEN']);
  });
});

describe('fetchLevelPlaySummary', () => {
  beforeEach(() => _resetLevelPlayTokenCache());
  const env = { LEVELPLAY_SECRET_KEY: 'sek-test-1234', LEVELPLAY_REFRESH_TOKEN: 'ref-test-5678' };
  const now = Date.parse('2026-10-13T12:00:00Z');

  it('is not_connected without env and never calls the network', async () => {
    let calls = 0;
    const r = await fetchLevelPlaySummary({ env: {}, now, fetchImpl: (async () => { calls++; return new Response('{}'); }) as unknown as typeof fetch });
    expect(r).toEqual({ status: 'not_connected', missing: ['LEVELPLAY_SECRET_KEY', 'LEVELPLAY_REFRESH_TOKEN'] });
    expect(calls).toBe(0);
  });

  it('authenticates once, caches the token, and summarizes', async () => {
    const seen: { url: string; headers: Record<string, string> }[] = [];
    const fetchImpl = (async (url: string, init?: { headers?: Record<string, string> }) => {
      seen.push({ url, headers: init?.headers ?? {} });
      if (url.includes('/partners/publisher/auth')) return new Response('"tok123"');
      return new Response(JSON.stringify({ data: [row('2026-10-13', 'iOS', 'Rewarded', 2, 200, 10, 5)], page: 1, pageSize: 1, totalResults: 1 }));
    }) as unknown as typeof fetch;
    const a = await fetchLevelPlaySummary({ env, now, fetchImpl });
    const b = await fetchLevelPlaySummary({ env, now: now + 60_000, fetchImpl });
    expect(a.status).toBe('ok');
    expect(b.status).toBe('ok');
    if (a.status === 'ok') expect(a.summary.last7.total.revenue).toBe(2);
    const auths = seen.filter((s) => s.url.includes('/auth'));
    expect(auths).toHaveLength(1);
    expect(auths[0].headers).toEqual({ secretkey: env.LEVELPLAY_SECRET_KEY, refreshToken: env.LEVELPLAY_REFRESH_TOKEN });
    expect(seen.find((s) => s.url.includes('levelPlay/reporting'))?.headers.Authorization).toBe('Bearer tok123');
  });

  it('returns an error result (no throw, no secrets) on auth or report failure', async () => {
    const authFail = (async () => new Response('no', { status: 401 })) as unknown as typeof fetch;
    const a = await fetchLevelPlaySummary({ env, now, fetchImpl: authFail });
    expect(a.status).toBe('error');
    expect(JSON.stringify(a)).not.toContain(env.LEVELPLAY_SECRET_KEY);
    _resetLevelPlayTokenCache();
    const reportFail = (async (url: string) => (url.includes('/auth') ? new Response('"t"') : new Response('x', { status: 500 }))) as unknown as typeof fetch;
    expect(await fetchLevelPlaySummary({ env, now, fetchImpl: reportFail })).toEqual({ status: 'error', error: 'LevelPlay reporting: HTTP 500' });
    _resetLevelPlayTokenCache();
    const boom = (async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    expect(await fetchLevelPlaySummary({ env, now, fetchImpl: boom })).toEqual({ status: 'error', error: 'network down' });
  });
});
