#!/usr/bin/env node
// FINISH_SPEC BJ3 — the web perf tour (docs/PERF_HARNESS.md).
//
// Dependency-free: launches its OWN headless Chrome (temp profile, never your
// browser) over the DevTools protocol, emulates a 390 × 844 phone with 4× CPU
// throttling, plays as a guest, and measures each step in-page: rAF frame gaps
// (> 25 / > 50 ms), long tasks (main-thread blocks ≥ 50 ms, total ms), layout
// shift, and forced-layout-heavy time via the Performance domain's LayoutDuration /
// RecalcStyleDuration deltas. Scrolls use Input.synthesizeScrollGesture (real
// touch-style scrolling), typing uses real key events.
//
//   node scripts/web-perf-tour.mjs                         # https://wordocious.com
//   node scripts/web-perf-tour.mjs http://localhost:3000   # a local `next start`
//   ONLY=home,classic node scripts/web-perf-tour.mjs
//   SEASON=halloween node scripts/web-perf-tour.mjs http://localhost:3000   # whole tour under the preview
//
// Measure a production build (`next build && next start`), never `next dev`.
// Report: apps/web/.perf/perf-tour-<stamp>.md

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] || 'https://wordocious.com').replace(/\/$/, '');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9300 + Math.floor(Math.random() * 500);
const wanted = (n) => !ONLY.length || ONLY.some((p) => n.startsWith(p));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'wordo-perf-'));
const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`,
  '--no-first-run', '--no-default-browser-check', '--mute-audio', 'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* not up yet */ }
    await sleep(200);
  }
  throw new Error('Chrome never came up');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, (m) => (m.error ? reject(new Error(`${method}: ${m.error.message}`)) : resolve(m.result)));
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.value;

await send('Page.enable');
await send('Performance.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 3, mobile: true });
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await send('Emulation.setCPUThrottlingRate', { rate: 4 });

// In-page monitor, installed on every navigation.
const MONITOR = `(() => {
  if (window.__perf) return;
  const p = window.__perf = { gaps: [], longMs: 0, longN: 0, cls: 0, last: 0, on: false };
  const loop = (t) => { if (p.on && p.last) p.gaps.push(t - p.last); p.last = t; requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (p.on) { p.longN++; p.longMs += e.duration; } }).observe({ type: 'longtask', buffered: false }); } catch {}
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (p.on && !e.hadRecentInput) p.cls += e.value; }).observe({ type: 'layout-shift', buffered: false }); } catch {}
})()`;
await send('Page.addScriptToEvaluateOnNewDocument', { source: MONITOR });

const metrics = async () => Object.fromEntries((await send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
const rows = [];

async function step(name, holdMs, action) {
  if (!wanted(name)) return;
  await evaluate(MONITOR);
  await evaluate('Object.assign(window.__perf, { gaps: [], longMs: 0, longN: 0, cls: 0, last: 0, on: true })');
  const before = await metrics();
  const t0 = Date.now();
  await action();
  await sleep(holdMs);
  const after = await metrics();
  const p = await evaluate('(() => { const p = window.__perf; p.on = false; return { gaps: p.gaps, longMs: p.longMs, longN: p.longN, cls: p.cls }; })()') || { gaps: [] };
  const gaps = p.gaps || [];
  const sorted = [...gaps].sort((a, b) => a - b);
  const p90 = sorted.length ? Math.round(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]) : 0;
  rows.push({
    p90, jank: gaps.length ? ((gaps.filter((g) => g > 25).length / gaps.length) * 100).toFixed(1) : '0.0',
    name, s: (Date.now() - t0) / 1000, frames: gaps.length,
    o25: gaps.filter((g) => g > 25).length, o50: gaps.filter((g) => g > 50).length,
    worst: Math.round(Math.max(0, ...gaps)), longN: p.longN, longMs: Math.round(p.longMs),
    layoutMs: Math.round(((after.LayoutDuration - before.LayoutDuration) + (after.RecalcStyleDuration - before.RecalcStyleDuration)) * 1000),
    scriptMs: Math.round((after.ScriptDuration - before.ScriptDuration) * 1000),
    cls: (p.cls || 0).toFixed(3),
  });
  const r = rows.at(-1);
  console.log(`${name.padEnd(22)} frames ${r.frames}  >25 ${r.o25} (${r.jank}%)  p90 ${r.p90}ms  >50 ${r.o50}  worst ${r.worst}ms  long ${r.longN}/${r.longMs}ms  layout+style ${r.layoutMs}ms  script ${r.scriptMs}ms`);
  await sleep(500);
}

// SEASON=halloween runs the whole tour under that season preview (every plain path gets ?season=).
const SEASON = process.env.SEASON || '';
async function go(path) {
  const p = SEASON && !path.includes('?') ? `${path}?season=${SEASON}` : path;
  await send('Page.navigate', { url: BASE + p });
  await sleep(4000);
}
const scrollBy = (dy) => send('Input.synthesizeScrollGesture', { x: 195, y: 500, yDistance: -dy, speed: 1600, gestureSourceType: 'touch' });
const scrollPage = async () => { await scrollBy(1800); await scrollBy(-1800); };
const key = async (k) => {
  const code = k.length === 1 ? `Key${k}` : k;
  const vk = k === 'Enter' ? 13 : k === 'Backspace' ? 8 : k.charCodeAt(0);
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k.length === 1 ? k.toLowerCase() : k, code, windowsVirtualKeyCode: vk, text: k.length === 1 ? k.toLowerCase() : k === 'Enter' ? '\r' : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k.length === 1 ? k.toLowerCase() : k, code, windowsVirtualKeyCode: vk });
};
const typeWord = async (w) => { for (const c of w) { await key(c); await sleep(110); } };
const clickText = (t) => evaluate(`(() => { const el = [...document.querySelectorAll('a,button')].find((e) => e.textContent.trim().toLowerCase().includes(${JSON.stringify(t.toLowerCase())})); if (el) el.click(); return !!el; })()`);

// Guest + launch.
await go('/');
await evaluate("localStorage.setItem('wordocious-guest', '1')");
// Past the first-run tour (AO) so Home / tabs measure Home, not the welcome overlay.
await evaluate("localStorage.setItem('onboarded-v2', '1')");
// A/B: PUPPETS=off measures the static cast header (components/ui/cast-puppets.ts kill switch).
await evaluate(process.env.PUPPETS === 'off' ? "localStorage.setItem('debug-puppets', 'off')" : "localStorage.removeItem('debug-puppets')");
await step('launch', 4000, () => send('Page.reload'));
await step('home.idle', 2000, async () => {});
await step('home.scroll', 600, scrollPage);
await step('tabs.toLeaderboard', 1500, () => clickText('Leaderboard'));
await step('leaderboard.scroll', 600, scrollPage);
await step('tabs.toFriends', 1500, () => clickText('Friends'));
await step('friends.scroll', 600, scrollPage);
await step('tabs.toHome', 1500, () => clickText('Home'));
for (const [p, path] of [['classic', '/practice'], ['quad', '/quadword'], ['octo', '/octoword'], ['gauntlet', '/gauntlet']]) {
  if (!wanted(p)) continue;
  await go(path);
  await step(`${p}.type`, 400, () => typeWord('CRANE'));
  await step(`${p}.submit`, 2200, () => key('Enter'));
  await step(`${p}.type2`, 400, () => typeWord('SLOTH'));
  await step(`${p}.submit2`, 2200, () => key('Enter'));
}
// 2.7.1 surfaces (guest-reachable): the season preview on Home, ProperNoundle + its clue card, Settings toggles.
// (Edit Profile — the Stage / Dressing Room / Title Shelves — needs a signed-in profile: not in a guest tour.)
const clickSel = (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (el) el.click(); return !!el; })()`);
if (wanted('season')) {
  await go('/?season=halloween');
  await step('season.on.home.scroll', 600, scrollPage);
  await go('/?season=auto');
  await step('season.off.home.scroll', 600, scrollPage);
}
if (wanted('propernoundle')) {
  await go('/');
  await step('propernoundle.open', 3500, () => clickText('ProperNoundle'));
  await step('propernoundle.clue.open', 2500, () => evaluate(`(() => { const el = [...document.querySelectorAll('button')].find((e) => e.textContent.trim() === 'Clue'); if (el) el.click(); return !!el; })()`));
  await step('propernoundle.clue.close', 1000, () => clickSel('[aria-label=Clue] button[aria-label=Close]'));
  await step('propernoundle.clue.reopen', 1000, () => clickSel('button[aria-label="Read clue"]'));
  await step('propernoundle.clue.close2', 1000, () => clickSel('[aria-label=Clue] button[aria-label=Close]'));
}
if (wanted('settings')) {
  await go('/');
  await step('settings.open', 1200, () => clickSel('button[aria-label="Settings"]'));
  await step('settings.toggle.flip', 800, () => clickSel('[role=dialog] [role=switch]'));
  await step('settings.toggle.back', 800, () => clickSel('[role=dialog] [role=switch]'));
  await step('settings.scroll', 600, scrollPage);
  await step('settings.close', 1000, () => send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 }).then(() => send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })));
}
if (wanted('strategy')) { await go('/guides'); await step('strategy.scroll', 600, scrollPage); }
if (wanted('muddle')) { await go('/muddle'); await step('muddle.type', 800, () => typeWord('STARE')); }
if (wanted('crossword')) { await go('/crosswordocious'); await step('crossword.type', 800, () => typeWord('STARELINE')); }

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', '.perf');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let md = `# Web perf tour ${stamp}\n\n${BASE} · 390×844 · CPU 4× throttle\n\n`;
md += '| step | s | frames | >25ms | janky % | p90 ms | >50ms | worst ms | long tasks | long ms | layout+style ms | script ms | CLS |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for (const r of rows) md += `| ${r.name} | ${r.s.toFixed(1)} | ${r.frames} | ${r.o25} | ${r.jank} | ${r.p90} | ${r.o50} | ${r.worst} | ${r.longN} | ${r.longMs} | ${r.layoutMs} | ${r.scriptMs} | ${r.cls} |\n`;
writeFileSync(join(dir, `perf-tour-${stamp}.md`), md);
console.log(`report: apps/web/.perf/perf-tour-${stamp}.md`);
ws.close();
chrome.kill();
// The temp Chrome profile is 100–150 MB a run; don't leave it in $TMPDIR.
await sleep(500);
try { rmSync(profile, { recursive: true, force: true }); } catch { /* best effort */ }
process.exit(0);
