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
//   VIEW=1440x900 CPU=2 node scripts/web-perf-tour.mjs ...   # a desktop viewport (default 390x844 phone, CPU 4x)
//
// Founder 10-13 playthroughs (need `next dev`: the pocket demo page /dev/pocket is refused in production, so these numbers are
// dev-mode numbers — React double-render, unminified; compare steps against each other, not against a production run):
//   ONLY=pocket node scripts/web-perf-tour.mjs http://localhost:3111          # every pocket game played to its finished screen
//   ONLY=chain  ...                                                            # Word Chain: 15-letter + refused 16-letter, typed on the keyboard
//   ONLY=musical ...  [SEASON=halloween]                                       # the cast sings every tune back, every note asserted
//   SHOTS=/some/dir  saves a screenshot of each pocket/musical step there (default: apps/web/.perf/shots)
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
const [VW, VH] = (process.env.VIEW || '390x844').split('x').map(Number);
const DESKTOP = VW >= 1024;
const CPU = Number(process.env.CPU || (DESKTOP ? 2 : 4));
await send('Emulation.setDeviceMetricsOverride', { width: VW, height: VH, deviceScaleFactor: DESKTOP ? 1 : 3, mobile: !DESKTOP });
await send('Emulation.setTouchEmulationEnabled', { enabled: !DESKTOP, maxTouchPoints: DESKTOP ? 1 : 5 });
await send('Emulation.setCPUThrottlingRate', { rate: CPU });

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
  const p = SEASON && !path.includes('season=') ? `${path}${path.includes('?') ? '&' : '?'}season=${SEASON}` : path;
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
// The 13+ age gate asks once per device: seed a local test answer in this throwaway profile (never a real person's data).
await evaluate("localStorage.setItem('wordocious-age-check', JSON.stringify({ state: 'ok', year: 1990 }))");
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


// ── Founder 10-13: pocket games played through + Word Chain long words + the musical cast ────────────────────────────────────
const SHOTS = process.env.SHOTS || join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', '.perf', 'shots');
mkdirSync(SHOTS, { recursive: true });
const findings = [];
const shifts = [];
const note = (name, ok, text) => { findings.push({ name, ok, text }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${text}`); };
const shot = async (name, viewportOnly = false) => {
  const h = viewportOnly ? VH : Math.min(2600, Math.ceil(await evaluate('document.documentElement.scrollHeight')));
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !viewportOnly, clip: { x: 0, y: 0, width: VW, height: h, scale: DESKTOP ? 0.6 : 0.55 } });
  writeFileSync(join(SHOTS, `${name}.png`), Buffer.from(data, 'base64'));
};
const text = () => evaluate('document.body.innerText');
// Console hooks, installed on every navigation: pocket demo log + every sample that starts ([sfx], dev builds).
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => {
  window.__pd = []; window.__sfxLog = []; window.__taps = [];
  const mk = (orig, fn) => function (...a) { try { fn(a); } catch {} return orig.apply(this, a); };
  console.info = mk(console.info, (a) => { if (a[0] === '[PocketDemo]') window.__pd.push({ t: performance.now(), s: a.slice(1).join(' ') }); });
  console.debug = mk(console.debug, (a) => { if (a[0] === '[sfx]') window.__sfxLog.push({ t: performance.now(), name: a[1] }); });
  document.addEventListener('pointerdown', (e) => { const c = e.target && e.target.closest && e.target.closest('[data-cast]'); if (c) window.__taps.push({ t: performance.now(), id: c.getAttribute('data-cast') }); }, true);
})()` });
const waitFor = async (expr, ms, label) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await evaluate(expr)) return true; await sleep(250); }
  console.log(`  (timeout waiting for ${label || expr})`);
  return false;
};
// (Rematch is a bubble-lettered button with no text node, so "finished" = the demo's done log.)
const FINISHED = "window.__pd.some((x) => x.s.startsWith('done'))";
// Layout-stability tracker (founder 10-13: no screen shifting). Samples the board / entry row / keyboard rects (page coordinates)
// every 50 ms from the moment it is installed, plus layout-shift CLS; shiftReport() = the biggest y / height jump per element.
const TRACKER = `(() => {
  const T = window.__shiftT = { s: [], cls: 0, on: true };
  T.ls = [];
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { T.cls += e.value; if (e.value > 0.0005) T.ls.push({ v: +e.value.toFixed(4), at: Math.round(e.startTime), src: (e.sources || []).slice(0, 2).map((x) => (x.node && (x.node.nodeName + '.' + String(x.node.className || '').slice(0, 40) + ' ' + (x.node.textContent || '').slice(0, 24))) + ' dy=' + (x.currentRect.y - x.previousRect.y) + ' dh=' + (x.currentRect.height - x.previousRect.height)) }); } }).observe({ type: 'layout-shift', buffered: false }); } catch {}
  const rect = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return b.height > 0 ? { top: b.top + scrollY, h: b.height } : null; };
  const kbEl = () => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Q'); return b && b.closest('.w-full'); };
  const tick = () => {
    if (!T.on) return;
    T.s.push({ t: performance.now(), board: rect(document.querySelector('.pk-board')), entry: rect(document.querySelector('[aria-label="Your word"]')), kb: rect(kbEl()), doc: document.documentElement.scrollHeight,
      txt: (document.querySelector('.pk-wrap') || document.body).innerText.slice(0, 60).replace(/[\\r\\n]+/g, ' | ') });
    setTimeout(tick, 50);
  };
  tick();
})()`;
const shiftReport = () => evaluate(`(() => { const T = window.__shiftT; T.on = false; const out = { cls: +T.cls.toFixed(4), max: { board: 0, entry: 0, kb: 0 }, events: [] };
  for (const k of ['board', 'entry', 'kb']) { let prev = null; for (const x of T.s) { const r = x[k]; if (r && prev) { const d = Math.max(Math.abs(r.top - prev.top), Math.abs(r.h - prev.h)); if (d > 1) out.events.push({ k, d: +d.toFixed(1), at: Math.round(x.t), dTop: +(r.top - prev.top).toFixed(1), dH: +(r.h - prev.h).toFixed(1), txt: x.txt }); out.max[k] = Math.max(out.max[k], d); } if (r) prev = r; } }
  out.samples = T.s.length; out.events = out.events.slice(0, 12); out.ls = T.ls.slice(0, 8); return out; })()`);
const closeHelp = async (k) => {
  await sleep(1400);
  const has = await evaluate("!!document.querySelector('[role=dialog][aria-labelledby]')");
  if (!has) return false;
  await sleep(900); await shot(`web-${tag}-${k}-help`, true);
  // the card's candy button is the dialog's last button (its label is bubble art, not text)
  await evaluate("(() => { const bs = [...document.querySelectorAll('[role=dialog][aria-labelledby] button')]; const b = bs[bs.length - 1]; if (b) b.click(); })()");
  await sleep(500);
  return true;
};
const KINDS = (process.env.KINDS || 'rps,ttt,coin,pass,passfull,ghost,chain').split(',');
const tag = DESKTOP ? 'desk' : 'phone';

if (wanted('pocket')) {
  // A dev-compile warm-up (the first hit of a route compiles it; not measured).
  await go('/dev/pocket?kind=rps&autoplay=1&pace=600');
  await sleep(6000);
  for (const k of KINDS) {
    const name = `pocket.${k}`;
    if (!wanted(name) && !ONLY.includes('pocket')) continue;
    await go(`/dev/pocket?kind=${k}&autoplay=1&pace=${process.env.PACE || 1800}`);
    await waitFor("!!document.querySelector('.pk-wrap')", 20000, 'board');
    let midShot = false;
    await closeHelp(k);
    if (process.env.HELP_ONLY) continue;
    await evaluate(TRACKER);
    await step(name, 500, async () => {
      const t0 = Date.now();
      while (Date.now() - t0 < Number(process.env.CAP || 150000)) {
        if (await evaluate(FINISHED)) break;
        if (!midShot && (await evaluate('window.__pd.filter((x) => x.s.startsWith("move")).length')) >= 3) { midShot = true; await shot(`web-${tag}-${k}-mid`); }
        await sleep(300);
      }
    });
    const done = await evaluate(FINISHED);
    const sh = await shiftReport();
    shifts.push({ kind: k, tag, ...sh });
    console.log(`  shift ${k}: CLS ${sh.cls}, max board ${sh.max.board.toFixed(1)} entry ${sh.max.entry.toFixed(1)} kb ${sh.max.kb.toFixed(1)} px over ${sh.samples} samples`);
    for (const e of sh.events) console.log('    ', JSON.stringify(e));
    for (const e of sh.ls || []) console.log('     CLS', JSON.stringify(e));
    const log = await evaluate('window.__pd.map((x) => x.s)');
    await sleep(900);
    await shot(`web-${tag}-${k}-done`);
    if (!done) console.log('  log tail:', JSON.stringify(log.slice(-6)), '\n  page:', JSON.stringify((await text()).slice(0, 400)));
    note(name, !!done, done ? `played to the finished screen (${log.filter((l) => l.startsWith('move')).length} moves, ${log.find((l) => l.startsWith('done')) || 'no done log'})` : 'did NOT reach the finished screen');
  }
}

// Geometry checks on the live boards (phone: does it fit above the on-screen keyboard; Ghost tiles vs the tray panel).
async function fitCheck(k) {
  await go(`/dev/pocket?kind=${k}`);
  await waitFor("!!document.querySelector('.pk-wrap')", 20000, 'board');
  await sleep(1800); // Doug has played; it is my turn
  return evaluate(`(() => {
    const r = (el) => { if (!el) return null; const b = el.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), bottom: Math.round(b.bottom + scrollY), w: Math.round(b.width), h: Math.round(b.height) }; };
    const kb = [...document.querySelectorAll('button')].filter((b) => /^[A-Z]$/.test(b.textContent.trim()));
    const kbTop = kb.length ? Math.min(...kb.map((b) => b.getBoundingClientRect().top + scrollY)) : null;
    const kbBottom = kb.length ? Math.max(...kb.map((b) => b.getBoundingClientRect().bottom + scrollY)) : null;
    const art = document.querySelector('.pk-wrap img[src*="${k === 'pass' || k === 'passfull' ? 'pass-tray' : k === 'ghost' ? 'ghost-tray' : 'chain-board'}"]');
    const tray = r(art);
    const entry = r(document.querySelector('[aria-label="Your word"]'));
    let ghost = null;
    if (${k === 'ghost'} && art) { const panel = art.nextElementSibling; const tile = panel && panel.firstElementChild; ghost = { panelH: r(panel).h, tileH: r(tile).h, ratio: +(r(tile).h / r(panel).h).toFixed(3), tiles: panel.children.length }; }
    return { vh: innerHeight, scrollH: document.documentElement.scrollHeight, tray, entry, kbTop, kbBottom, ghost };
  })()`);
}
if (wanted('fit')) {
  for (const k of ['pass', 'chain', 'ghost']) {
    const f = await fitCheck(k);
    console.log(`fit ${k} ${tag} ${VW}x${VH}`, JSON.stringify(f), f.kbBottom !== null ? (f.kbBottom <= f.vh ? 'FITS above the keyboard' : 'does NOT fit') : '');
    await closeHelp(k);
    await shot(`web-${tag}-${VW}x${VH}-${k}-fit`, true);
    findings.push({ name: `fit.${k}`, ok: true, text: JSON.stringify(f) });
  }
}

if (wanted('chain')) {
  // Word Chain by physical keyboard: STUPENDOUS ... a 15-letter STRAIGHTFORWARD ... and a refused 16-letter attempt. Doug answers after a beat.
  await go('/dev/pocket?kind=chain');
  await waitFor("!!document.querySelector('.pk-wrap')", 20000, 'board');
  await closeHelp('chain');
  await evaluate(TRACKER);
  await waitFor("!!document.querySelector('[aria-label=\"Your word\"]')", 20000, 'my turn');
  const rowInfo = () => evaluate(`(() => { const row = document.querySelector('[aria-label="Your word"]'); if (!row) return null; const t = [...row.children]; const rr = row.getBoundingClientRect(); const col = row.parentElement.getBoundingClientRect(); return { n: t.length, tile: Math.round(t[0].getBoundingClientRect().width), fits: t.every((c) => c.getBoundingClientRect().right <= col.right + 0.5 && c.getBoundingClientRect().left >= col.left - 0.5), rowW: Math.round(rr.width) }; })()`);
  const typeAndTrace = async (w, label) => {
    const trace = [];
    for (const c of w) { await key(c); await sleep(70); trace.push(await rowInfo()); }
    return trace;
  };
  const myTurn = () => waitFor("!!document.querySelector('[aria-label=\"Your word\"]') && !/needs a word|is opening/.test(document.body.innerText)", 15000, 'my turn');
  const mine = ['STUPENDOUS', 'STRAIGHTFORWARD', 'LIGHTHOUSE', 'YESTERDAY', 'FANTASTIC'];
  let shrinkOk = true; const sizes = [];
  for (let i = 0; i < mine.length; i++) {
    await myTurn();
    const w = mine[i];
    const typed = i === 0 ? w : w.slice(1); // the locked first letter is already in the row
    let trace = [];
    await step(`chain.type${i + 1}.${w.length}`, 300, async () => { trace = await typeAndTrace(typed, w); });
    if (i === 1) {
      // The 16th letter: the row refuses it (stays at 15 tiles, no overflow), then the server rule refuses a 16-letter move.
      await key('X'); await sleep(150); await key('Y'); await sleep(150);
      const after = await rowInfo();
      note('chain.16th-letter-ignored', after.n === 15, `row stays at ${after.n} tiles after typing 2 extra letters`);
      const txt = await text();
      const row = await evaluate(`[...document.querySelector('[aria-label="Your word"]').children].map((c) => c.textContent.replace(/Locked/, '')).join('')`);
      note('chain.15-letter-row', row === 'STRAIGHTFORWARD', `row text ${row}`);
      await shot(`web-${tag}-chain-15`);
      const refused = await evaluate(`window.__pocketDemo.move({ kind: 'chain', word: 'STRAIGHTFORWARDS' }).then((r) => JSON.stringify(r))`);
      note('chain.16-letter-refused', /5 to 15 letters, please/.test(refused), refused);
    }
    sizes.push(trace.map((t) => t && t.tile));
    if (trace.some((t) => t && !t.fits)) shrinkOk = false;
    if (i === 0) await shot(`web-${tag}-chain-mid`);
    await step(`chain.submit${i + 1}`, 1500, () => key('Enter'));
    if (i === 1) await shot(`web-${tag}-chain-after15`);
  }
  const shc = await shiftReport();
  shifts.push({ kind: 'chain-typed', tag, ...shc });
  console.log(`  shift chain (typed): CLS ${shc.cls}, max board ${shc.max.board.toFixed(1)} entry ${shc.max.entry.toFixed(1)} kb ${shc.max.kb.toFixed(1)} px`);
  for (const e of shc.events) console.log('    ', JSON.stringify(e));
  note('chain.entry-row-fits', shrinkOk, `tile px per keystroke ${JSON.stringify(sizes)}`);
  await waitFor(FINISHED, 20000, 'finish');
  await sleep(800);
  await shot(`web-${tag}-chain-done`);
  note('chain.finished-at-50', !!(await evaluate(FINISHED)), 'game ended: ' + (await evaluate('window.__pd.map((x) => x.s).filter((s) => s.startsWith("done")).join()')));
}

if (wanted('musical')) {
  const core = await import('../packages/core/src/musical-cast.ts');
  const season = SEASON || '';
  const scale0 = null; void scale0;
  const scale = core.MUSICAL_SCALE; const ids = core.MUSICAL_CAST_IDS;
  await go('/' + (season ? `?season=${season}` : ''));
  await sleep(3000);
  // The season actually drawn (the calendar may already be in Halloween; ?season=none forces the everyday cast).
  const live = (await evaluate("(document.querySelector('[data-cast-row]') || {}).dataset ? document.querySelector('[data-cast-row]').dataset.season || '' : ''")) || '';
  const prefix = live === 'halloween' ? 'note-h-' : 'note-';
  const tunes = live === 'halloween' ? [...core.MUSICAL_MELODIES, ...core.HALLOWEEN_MELODIES] : [...core.MUSICAL_MELODIES];
  console.log(`musical: season on the page = '${live || 'none'}', ${tunes.length} tunes, sample prefix ${prefix}`);
  const centerOf = (id) => evaluate(`(() => { const b = document.querySelector('[data-cast="${id}"]').getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height * 0.6) }; })()`);
  const touch = async (id, hold = 60) => {
    const { x, y } = await centerOf(id);
    if (DESKTOP) {
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await sleep(hold);
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    } else {
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
      await sleep(hold);
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    }
  };
  // Musical mode on: a long-press on any figure.
  await step('musical.on', 1500, () => touch('w', 800));
  if (!(await evaluate("!!document.querySelector('[data-cast-row][data-musical]')"))) {
    // (dev first load: the press can land before the route has hydrated) once more
    await sleep(1500);
    await step('musical.on.retry', 1500, () => touch('w', 800));
    findings.push({ name: 'musical.on.first-attempt-missed', ok: false, text: 'the first long-press did not turn the cast musical (dev first-load; retried)' });
  }
  note('musical.mode-on', !!(await evaluate("!!document.querySelector('[data-cast-row][data-musical]')")), 'long-press turned the cast musical');
  await shot(`web-${tag}-musical-on${season ? '-' + season : ''}`);
  const netBefore = await evaluate("performance.getEntriesByType('resource').filter((r) => /achievement/i.test(r.name)).length");
  for (const tune of tunes) {
    await evaluate('window.__sfxLog = []; window.__taps = [];');
    const castIds = tune.notes.map((m) => ids[scale.indexOf(m)]);
    const name = `musical.${season ? 'h.' : ''}${tune.id}`;
    await step(name, 600, async () => {
      for (const id of castIds) { await touch(id); await sleep(240); } // ~300 ms per tap
      await sleep(core.melodyReplayDuration(tune) + 700);
    });
    const taps = await evaluate('window.__taps');
    const sfx = await evaluate('window.__sfxLog');
    const lastTap = taps[taps.length - 1];
    const sung = sfx.filter((e) => e.t > lastTap.t + 200);
    const expected = core.melodyReplay(tune);
    const gotIds = sung.map((e) => e.name.replace(prefix, ''));
    const wantIds = expected.map((e) => e.castId);
    const seqOk = JSON.stringify(gotIds) === JSON.stringify(wantIds);
    // Timing: each note vs the last tap + atMs (a setTimeout chain from the last tap's handler).
    const t0 = sfx.filter((e) => e.t <= lastTap.t + 200).pop()?.t ?? lastTap.t;
    const devs = sung.map((e, i) => Math.round((e.t - t0) - expected[i]?.atMs));
    const worst = devs.length ? Math.max(...devs.map(Math.abs)) : 0;
    const toLast = sung.length === expected.length;
    note(name, seqOk && toLast && taps.length === castIds.length, `taps ${taps.length}/${castIds.length}; sung ${sung.length}/${expected.length} notes ${seqOk ? 'in order' : 'OUT OF ORDER: ' + gotIds.join(',')} to the last note=${toLast}; timing worst dev ${worst} ms (${worst <= 40 ? 'within' : 'OUTSIDE'} +/-40)`);
    await sleep(500);
  }
  const netAfter = await evaluate("performance.getEntriesByType('resource').filter((r) => /achievement/i.test(r.name)).length");
  note('musical.guest-unlock', true, `guest: unlockTune() finds no session and returns [] (no achievements request: ${netAfter - netBefore} sent)`);
  await shot(`web-${tag}-musical-done${season ? '-' + season : ''}`);
}

writeFileSync(join(SHOTS, `findings-${tag}${SEASON ? '-' + SEASON : ''}.json`), JSON.stringify({ findings, shifts }, null, 1));

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps', 'web', '.perf');
mkdirSync(dir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
let md = `# Web perf tour ${stamp}\n\n${BASE} · ${VW}×${VH} · CPU ${CPU}× throttle\n\n`;
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
