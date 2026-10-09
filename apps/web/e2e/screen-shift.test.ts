// Screen-shift harness (FRIDAY-QUEUE item 37, founder 10-08: "no screen shifting anywhere like Codebreaker").
// Scripted play in a real Chromium: before and after EVERY action it measures the bounding boxes of the named
// regions (header, board, chip strip, control bar, keyboard …); any region that moves or resizes by more than
// 1 px that isn't the piece being played is a failure. Layout-shift entries (CLS) are recorded as well.
//
//   pnpm test:shift                       (boots `next dev` on :3124 unless SHIFT_BASE_URL is set)
//   SHIFT_ONLY=codebreaker pnpm test:shift
//   SHIFT_SEASONS=none,halloween …        (default: none — the season skin changes no layout)
//
// Add a game: push a Scenario onto SCENARIOS (a route, the regions to watch, the scripted steps). The report lands
// in e2e/.shift-report.json (every step's measured deltas) so the sweep can file a short failures list.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { describeShift, diffBoxes, type Boxes, type Shift } from '../lib/screen-shift';

const PORT = 3124;
const BASE = process.env.SHIFT_BASE_URL ?? `http://127.0.0.1:${PORT}`;
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROMIUM = process.env.SHIFT_CHROMIUM ?? process.env.CONTRAST_CHROMIUM
  ?? (fs.existsSync(MAC_CHROME) ? MAC_CHROME : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const ONLY = process.env.SHIFT_ONLY?.split(',').filter(Boolean);
const SEASONS = (process.env.SHIFT_SEASONS ?? 'none').split(',').filter(Boolean);
const SETTLE_MS = Number(process.env.SHIFT_SETTLE_MS ?? 700);

interface Step {
  label: string;
  run: (page: Page) => Promise<void>;
  /** Regions that may change in this step (the piece being played). */
  allowed?: string[];
}
interface Scenario {
  id: string;
  path: string;
  /** Region name → CSS selector (first visible match). */
  regions: Record<string, string>;
  /** Regions that may be absent before play (a game without a keyboard / grid role); if one appears later it is a shift. */
  optional?: string[];
  steps: Step[];
}

const press = (...keys: string[]) => async (page: Page) => { for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(60); } };
const click = (selector: string) => async (page: Page) => { await page.locator(selector).locator('visible=true').first().click({ timeout: 10_000 }); };

const SCENARIOS: Scenario[] = [
  {
    // The reported case: a letter landing used to widen its chip, re-wrap the strip and shrink the board; a
    // conflict message used to be a line in the layout.
    id: 'codebreaker',
    path: '/codebreaker?daily=true',
    regions: {
      header: '.game-art-header',
      board: '[role="group"][aria-label="Coded saying"]',
      strip: '[role="group"][aria-label="Letter frequencies"]',
      controls: '[role="group"][aria-label="Codebreaker controls"]',
      keyboard: '[role="group"][aria-label="Game keyboard"]',
    },
    steps: [
      { label: 'select the first code letter', run: click('[role="group"][aria-label="Letter frequencies"] button') },
      { label: 'pencil E (correct or not, a chip gains its →E)', run: press('E') },
      { label: 'pencil T', run: press('T') },
      { label: 'pencil E again (two code letters → the conflict toast)', run: press('E') },
      { label: 'wait out the toast', run: async (p) => { await p.waitForTimeout(1600); } },
      { label: 'delete a letter', run: press('Backspace') },
      { label: 'pencil A, O, I, N, S, H', run: press('A', 'O', 'I', 'N', 'S', 'H') },
      { label: 'Check', run: click('[aria-label^="Check the penciled letters"]') },
      { label: 'Hint', run: click('[aria-label^="Hint: reveal one letter"]') },
      { label: 'Hint again', run: click('[aria-label^="Hint: reveal one letter"]') },
    ],
  },
  {
    // The shared word-game board: typing fills tiles, an invalid word flashes a message (toast, never a line).
    id: 'classic',
    path: '/practice?daily=true',
    regions: {
      header: '.game-art-header',
      board: '[role="grid"][aria-label="Game board"]',
      keyboard: '[role="group"][aria-label="Game keyboard"]',
    },
    steps: [
      { label: 'focus the page', run: async (p) => { await p.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); } },
      { label: 'type Q, Z', run: press('Q', 'Z') },
      { label: 'fill the row with QZXQZ', run: press('X', 'Q', 'Z') },
      { label: 'Enter (not a word → toast)', run: press('Enter') },
      { label: 'wait out the toast', run: async (p) => { await p.waitForTimeout(1600); } },
      { label: 'delete two', run: press('Backspace', 'Backspace') },
      { label: 'a valid guess: CRANE', run: press('Backspace', 'Backspace', 'Backspace', 'C', 'R', 'A', 'N', 'E', 'Enter') },
      { label: 'a second valid guess: SLOTH', run: press('S', 'L', 'O', 'T', 'H', 'Enter') },
    ],
  },
];

/** The generic typing script every keyboard word game shares: letters, a bad submit (toast), delete, more letters. */
const TYPING: Step[] = [
  { label: 'focus the page', run: async (p) => { await p.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {}); } },
  { label: 'type Q, Z, X', run: press('Q', 'Z', 'X') },
  { label: 'Enter (a message / toast)', run: press('Enter') },
  { label: 'wait out the toast', run: async (p) => { await p.waitForTimeout(1600); } },
  { label: 'delete', run: press('Backspace', 'Backspace') },
  { label: 'type more letters', run: press('A', 'E', 'R', 'S', 'T', 'O') },
  { label: 'Enter again', run: press('Enter') },
];
const GENERIC_REGIONS = {
  header: '.game-art-header',
  board: '[role="grid"], [role="group"][aria-label="Coded saying"]',
  keyboard: '[role="group"][aria-label="Game keyboard"]',
};
// More games: add an id here as its selectors are known; the Haiku sweep after each wave (item 37) extends it.
for (const [id, route] of [
  ['six', '/six?daily=true'], ['seven', '/seven?daily=true'], ['quadword', '/quadword?daily=true'], ['octoword', '/octoword?daily=true'],
  ['hubbub', '/hubbub?daily=true'], ['muddle', '/muddle?daily=true'], ['kindred', '/kindred?daily=true'], ['letter-ladder', '/letter-ladder?daily=true'],
  ['crosswordocious', '/crosswordocious?daily=true'], ['propernoundle', '/propernoundle?daily=true'],
]) {
  SCENARIOS.push({ id, path: route, regions: GENERIC_REGIONS, optional: ['board', 'keyboard'], steps: TYPING });
}

let server: ChildProcess | null = null;
let browser: Browser;
const report: { scenario: string; season: string; step: string; shifts: Shift[]; cls: number }[] = [];

async function waitForServer(url: string, ms: number): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if ((await fetch(url)).status < 500) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`server at ${url} did not come up`);
}

beforeAll(async () => {
  if (!process.env.SHIFT_BASE_URL) {
    server = spawn('npx', ['next', 'dev', '-p', String(PORT)], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'screen-shift',
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_OPTIONS: process.env.NODE_OPTIONS ?? '--max-old-space-size=6144',
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
  fs.writeFileSync(process.env.SHIFT_REPORT ?? path.join(__dirname, '.shift-report.json'), JSON.stringify(report, null, 2));
});

async function measure(page: Page, regions: Record<string, string>): Promise<Boxes> {
  const out: Boxes = {};
  for (const [name, selector] of Object.entries(regions)) {
    const el = page.locator(selector).locator('visible=true').first();
    out[name] = (await el.count()) ? await el.boundingBox() : null;
  }
  return out;
}

async function open(scenario: Scenario, season: string): Promise<Page> {
  // A guest on a 390 × 844 phone, onboarded, intro skipped; the Supabase project is unreachable (guest play needs none).
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'light' });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('wordle-duel-theme', 'light');
      sessionStorage.setItem('wordocious-intro-shown', '1');
      localStorage.setItem('onboarded-v2', '1');
      localStorage.setItem('wordocious-guest', '1');
    } catch { /* storage blocked */ }
    // Layout-shift entries not caused by input (the browser's own CLS), summed.
    (window as unknown as { __cls: number }).__cls = 0;
    try {
      new PerformanceObserver((list) => {
        for (const e of list.getEntries() as unknown as { value: number; hadRecentInput: boolean }[]) {
          if (!e.hadRecentInput) (window as unknown as { __cls: number }).__cls += e.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch { /* unsupported */ }
  });
  const page = await ctx.newPage();
  await page.route(/supabase\.co|sentry|googletagmanager|google-analytics|posthog/, (r) => r.abort());
  await page.route(/127\.0\.0\.1:9\//, (r) => r.abort());
  const sep = scenario.path.includes('?') ? '&' : '?';
  await page.goto(`${BASE}${scenario.path}${sep}season=${season}`, { waitUntil: 'load', timeout: 120_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return page;
}

const scenarios = SCENARIOS.filter((s) => !ONLY || ONLY.includes(s.id));

describe('screen shift (scripted play, bounding boxes before vs after every action)', () => {
  for (const season of SEASONS) {
    for (const scenario of scenarios) {
      it(`${scenario.id} · ${season}`, async () => {
        const page = await open(scenario, season);
        const failures: string[] = [];
        try {
          const first = await measure(page, scenario.regions);
          for (const [name, box] of Object.entries(first)) {
            if (scenario.optional?.includes(name)) continue;
            expect(box, `${scenario.id}: region "${name}" (${scenario.regions[name]}) not found before play`).not.toBeNull();
          }
          for (const step of scenario.steps) {
            const before = await measure(page, scenario.regions);
            const cls0 = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
            await step.run(page);
            await page.waitForTimeout(SETTLE_MS);
            const after = await measure(page, scenario.regions);
            const cls = (await page.evaluate(() => (window as unknown as { __cls: number }).__cls)) - cls0;
            const shifts = diffBoxes(before, after, { allowed: step.allowed });
            report.push({ scenario: scenario.id, season, step: step.label, shifts, cls: Math.round(cls * 10000) / 10000 });
            for (const s of shifts) failures.push(describeShift(scenario.id, step.label, s));
          }
        } finally {
          await page.context().close();
        }
        expect(failures, 'regions moved or resized during play').toEqual([]);
      }, 240_000);
    }
  }
});
