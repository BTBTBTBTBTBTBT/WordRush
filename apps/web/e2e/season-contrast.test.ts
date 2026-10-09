// Rendered season contrast sweep (WCAG AA on the real pixels). For every screen / state in SCREENS,
// every season in the registry (lib/season-kit SEASON_REGISTRY — a new season is swept with no edit
// here) plus no season, in light and dark: load `?season=<id>` (or `?season=none`), collect every
// visible run of text with its painted color, hide all text, screenshot, and check the text color
// against the pixels inside each line box (the median ratio must clear 4.5:1, 3:1 for large text).
//
//   pnpm test:contrast                 (boots `next dev` on :3123 unless CONTRAST_BASE_URL is set)
//   CONTRAST_ONLY=home,stats CONTRAST_SEASONS=halloween pnpm test:contrast
//   CONTRAST_SHOTS=/some/dir …           (also saves each screen as rendered, text visible)
//
// Supabase is faked (see `open`): guests get nothing back, a signed-in screen gets a fresh, empty
// account — so data screens show their empty states. The report lands in e2e/.contrast-report.json.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { chromium, type Browser, type Page } from 'playwright-core';
import { SEASON_REGISTRY } from '../lib/season-kit';
import { aaMinimum, contrastRatio, type RGBA } from '../lib/contrast';
import { HIDE_TEXT_CSS, STILL_CSS, collectText, type TextRun } from './contrast-probe';
import { SCREENS, type Screen } from './contrast-screens';

const PORT = 3123;
const BASE = process.env.CONTRAST_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const CHROMIUM = process.env.CONTRAST_CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const ONLY = process.env.CONTRAST_ONLY?.split(',').filter(Boolean);
const SEASONS: (string | null)[] = [null, ...SEASON_REGISTRY.map((s) => s.id)]
  .filter((s) => !process.env.CONTRAST_SEASONS || process.env.CONTRAST_SEASONS.split(',').includes(s ?? 'none'));
const THEMES = ['light', 'dark'] as const;

export interface Failure {
  screen: string;
  season: string;
  theme: string;
  text: string;
  path: string;
  color: string;
  background: string;
  ratio: number;
  min: number;
}

let server: ChildProcess | null = null;
let browser: Browser;
const failures: Failure[] = [];
const checked: { screen: string; season: string; theme: string; runs: number }[] = [];

async function waitForServer(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.status < 500) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server at ${url} did not come up`);
}

beforeAll(async () => {
  if (!process.env.CONTRAST_BASE_URL) {
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'contrast-sweep',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: 'ignore',
      detached: true,
    });
  }
  await waitForServer(`${BASE}/about`, 180_000);
  browser = await chromium.launch({ executablePath: CHROMIUM });
}, 240_000);

afterAll(async () => {
  await browser?.close();
  if (server?.pid) try { process.kill(-server.pid); } catch { /* gone */ }
  fs.writeFileSync(
    process.env.CONTRAST_REPORT ?? path.join(__dirname, '.contrast-report.json'),
    JSON.stringify({ checked, failures }, null, 2),
  );
});

function hex([r, g, b]: number[]): string {
  return '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
}

/** The text runs that miss AA against the pixels behind them. */
async function sweep(page: Page, shot?: string): Promise<{ runs: TextRun[]; misses: Omit<Failure, 'screen' | 'season' | 'theme'>[] }> {
  await page.addStyleTag({ content: STILL_CSS });
  // The whole page as one viewport, so every line box can be hit-tested (and the screenshot is 1:1).
  const height = await page.evaluate(() => Math.min(6000, Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
  await page.setViewportSize({ width: 390, height: Math.max(844, height) });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  const runs = await page.evaluate(collectText);
  if (shot) await page.screenshot({ path: shot });
  await page.addStyleTag({ content: HIDE_TEXT_CSS });
  await page.waitForTimeout(100);
  const png = await page.screenshot({ animations: 'disabled', caret: 'hide' });
  const { data, info } = await sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const misses: Omit<Failure, 'screen' | 'season' | 'theme'>[] = [];
  for (const run of runs) {
    const ratios: { ratio: number; bg: [number, number, number] }[] = [];
    for (const r of run.rects) {
      const x0 = Math.max(0, Math.floor(r.x));
      const y0 = Math.max(0, Math.floor(r.y));
      const x1 = Math.min(W - 1, Math.ceil(r.x + r.w));
      const y1 = Math.min(H - 1, Math.ceil(r.y + r.h));
      const step = Math.max(1, Math.floor(Math.min(x1 - x0, y1 - y0) / 6));
      for (let y = y0; y <= y1; y += step) {
        for (let x = x0; x <= x1; x += step) {
          const i = (y * W + x) * 3;
          const bg: [number, number, number] = [data[i], data[i + 1], data[i + 2]];
          ratios.push({ ratio: contrastRatio(run.color as RGBA, [...bg, 1]), bg });
        }
      }
    }
    if (!ratios.length) continue;
    ratios.sort((a, b) => a.ratio - b.ratio);
    const mid = ratios[Math.floor(ratios.length / 2)];
    const min = aaMinimum(run.fontSize, run.fontWeight);
    if (mid.ratio + 1e-6 < min) {
      misses.push({
        text: run.text,
        path: run.path,
        color: hex(run.color) + (run.color[3] < 1 ? ` @${run.color[3].toFixed(2)}` : ''),
        background: hex(mid.bg),
        ratio: Math.round(mid.ratio * 100) / 100,
        min,
      });
    }
  }
  return { runs, misses };
}

// A signed-in player with an empty account: a stored (unexpiring) Supabase session for the fake
// project, and the fake project answering the profile read with a fresh row and every other read
// with nothing — so signed-in screens show their real empty states.
const USER_ID = '00000000-0000-4000-8000-00000000c0de';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const FAKE_JWT = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', exp: 4102444800 })}.sig`;
const FAKE_USER = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'sweep@example.com', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };
const FAKE_SESSION = { access_token: FAKE_JWT, refresh_token: 'r', token_type: 'bearer', expires_in: 3600, expires_at: 4102444800, user: FAKE_USER };
const FAKE_PROFILE = {
  id: USER_ID, username: 'Sweeper', avatar_url: null, level: 3, xp: 120, total_wins: 0, total_losses: 0,
  current_streak: 0, best_streak: 0, gold_medals: 0, silver_medals: 0, bronze_medals: 0, last_played_at: null,
  daily_login_streak: 0, best_daily_login_streak: 0, streak_shields: 0, is_pro: false, pro_expires_at: null,
  stripe_customer_id: null, stripe_subscription_id: null, pro_prompt_shown: true, role: 'user', is_admin: false,
  is_banned: false, ban_reason: null, has_onboarded: true, is_private: false,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
};

async function open(screen: Screen, season: string | null, theme: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', colorScheme: theme as 'light' | 'dark' });
  const as = screen.as ?? 'guest';
  await ctx.addInitScript(({ theme, as, storage, session }) => {
    try {
      localStorage.setItem('wordle-duel-theme', theme);
      // Skip the cold-start intro (lib/intro.ts) and, unless this IS the first visit, the first-run tour.
      sessionStorage.setItem('wordocious-intro-shown', '1');
      if (as !== 'new') localStorage.setItem('onboarded-v2', '1');
      if (as === 'guest') localStorage.setItem('wordocious-guest', '1');
      if (as === 'user') localStorage.setItem('sb-127-auth-token', JSON.stringify(session));
      for (const [k, v] of Object.entries(storage)) localStorage.setItem(k, v);
    } catch { /* storage blocked */ }
  }, { theme, as, storage: screen.storage ?? {}, session: FAKE_SESSION });
  const page = await ctx.newPage();
  await page.route(/supabase\.co|sentry|googletagmanager|google-analytics|posthog/, (r) => r.abort());
  await page.route(/127\.0\.0\.1:9\//, (r) => {
    const url = r.request().url();
    if (as !== 'user') return r.abort();
    const json = (body: unknown) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
    if (r.request().method() === 'OPTIONS') return r.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (url.includes('/auth/v1/user')) return json(FAKE_USER);
    if (url.includes('/rest/v1/profiles')) {
      const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return json(single ? FAKE_PROFILE : [FAKE_PROFILE]);
    }
    if (url.includes('/rest/v1/rpc/')) return json(null);
    if (url.includes('/rest/v1/')) {
      const single = (r.request().headers()['accept'] ?? '').includes('vnd.pgrst.object');
      return single ? r.fulfill({ status: 406, contentType: 'application/json', body: '{"code":"PGRST116"}' }) : json([]);
    }
    return r.abort();
  });
  const sep = screen.path.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${screen.path}${sep}season=${season ?? 'none'}`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(screen.settle ?? 1200);
  if (screen.act) await screen.act(page);
  return page;
}

const screens = SCREENS.filter((s) => !ONLY || ONLY.includes(s.id));

describe('season contrast (WCAG AA on rendered pixels)', () => {
  for (const season of SEASONS) {
    for (const theme of THEMES) {
      for (const screen of screens) {
        const label = `${screen.id} · ${season ?? 'no season'} · ${theme}`;
        it(label, async () => {
          const page = await open(screen, season, theme);
          try {
            const shot = process.env.CONTRAST_SHOTS ? path.join(process.env.CONTRAST_SHOTS, `${screen.id}-${season ?? 'none'}-${theme}.png`) : undefined;
            const { runs, misses } = await sweep(page, shot);
            checked.push({ screen: screen.id, season: season ?? 'none', theme, runs: runs.length });
            for (const m of misses) failures.push({ screen: screen.id, season: season ?? 'none', theme, ...m });
            expect(runs.length, `${label}: no text found (page failed to render?)`).toBeGreaterThan(0);
            expect(misses, `${label}: text below AA`).toEqual([]);
          } finally {
            await page.context().close();
          }
        }, 180_000);
      }
    }
  }
});
