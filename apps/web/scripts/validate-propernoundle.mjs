#!/usr/bin/env node
/**
 * Gate for the ProperNoundle answer bank: EVERY entry must produce a real clue.
 *
 * Why this exists: puzzle #980 (Stellaris) shipped with the clue "______ may
 * refer to:" — Wikipedia's article for that exact title is a DISAMBIGUATION
 * page, whose extract is that stub sentence and nothing else. The founder's
 * rule after that: an answer with no usable clue does not belong in the bank.
 *
 * A clue is only as good as what survives REDACTION, so this runs the app's
 * own sanitizeHint (ported verbatim from components/propernoundle/wikipedia.ts)
 * and judges the finished string a player would actually read.
 *
 * Run: node apps/web/scripts/validate-propernoundle.mjs [--json]
 * Exits non-zero if any entry fails, so it can gate a commit or CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const BANK = path.join(ROOT, 'data', 'propernoundle-puzzles.json');
const UA = 'WordociousBankValidator/1.0 (https://wordocious.com)';
const puzzles = JSON.parse(fs.readFileSync(BANK, 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- ported verbatim from components/propernoundle/wikipedia.ts ----
const SINGLE_WORD_ABBREVIATIONS = ['No','Nos','Mr','Mrs','Ms','Dr','Prof','Sr','Jr','St','Mt','Ft',
  'Inc','Ltd','Co','Corp','Bros','etc','vs','cf','al','e.g','i.e',
  'Jan','Feb','Mar','Apr','Jun','Jul','Aug','Sep','Sept','Oct','Nov','Dec',
  'Mon','Tue','Tues','Wed','Thu','Thur','Thurs','Fri','Sat','Sun'];

function sanitizeHint(extract, displayName, redact = true) {
  let p = extract.replace(/\b([A-Z])\.\s?([A-Z])\.(\s?[A-Z]\.)?/g, (m) => m.replace(/\./g, '###'));
  for (const abbr of SINGLE_WORD_ABBREVIATIONS) {
    const esc = abbr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    p = p.replace(new RegExp(`\\b${esc}\\.`, 'gi'), (m) => m.replace(/\./g, '###'));
  }
  const sentences = p.match(/[^.!?]+[.!?]+/g) || [p];
  const build = (n) => sentences.slice(0, n).join(' ').trim().replace(/###/g, '.');
  let take = Math.min(2, sentences.length);
  if (redact) {
    while (take < sentences.length && informativeLength(redactAnswer(build(take), displayName)) < 60) take++;
  }
  const hint = build(take);
  if (!redact) return hint;
  return redactAnswer(hint, displayName);
}

function informativeLength(clue) {
  return clue.replace(/______/g, ' ').replace(/\s+/g, ' ').trim().length;
}

function redactAnswer(hint, displayName) {
  const parts = displayName.split(/\s+/).filter((x) => x.length > 2);
  const COMBINING = '[̀-ͯ]*';
  hint = hint.normalize('NFD');
  for (const pattern of [displayName, ...parts]) {
    const re = pattern.normalize('NFD').replace(/[̀-ͯ]/g, '').split('')
      .map((ch) => (/\s/.test(ch) ? '\\s+' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + COMBINING)).join('');
    hint = hint.replace(new RegExp(re, 'gi'), '______');
  }
  return hint.normalize('NFC').replace(/(______\s*)+/g, '______').replace(/______(\w)/g, '______ $1');
}

// ---- fetch extracts, 20 titles per call (TextExtracts caps exlimit at 20) ----
const titleOf = (p) => p.wikiTitle || p.display;
async function getJSON(url, tries = 0) {
  const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
  if ((r.status === 429 || r.status >= 500) && tries < 5) { await sleep(4000 * (tries + 1)); return getJSON(url, tries + 1); }
  if (!r.ok) throw new Error('http ' + r.status);
  return r.json();
}

const info = new Map();
for (let i = 0; i < puzzles.length; i += 20) {
  const batch = puzzles.slice(i, i + 20);
  const url = 'https://en.wikipedia.org/w/api.php?action=query&format=json&formatversion=2&redirects=1'
    + '&prop=extracts|pageprops&ppprop=disambiguation&exintro=1&explaintext=1&exlimit=max&titles='
    + encodeURIComponent(batch.map(titleOf).join('|'));
  const q = (await getJSON(url)).query || {};
  const step = new Map();
  for (const n of q.normalized || []) step.set(n.from, n.to);
  for (const r of q.redirects || []) step.set(r.from, r.to);
  const resolve = (t) => { let c = t, n = 0; while (step.has(c) && n++ < 5) c = step.get(c); return c; };
  const byTitle = new Map((q.pages || []).map((p) => [p.title, p]));
  for (const p of batch) {
    const page = byTitle.get(resolve(titleOf(p)));
    info.set(p.id, {
      missing: !page || page.missing === true,
      disambig: !!(page && page.pageprops && 'disambiguation' in page.pageprops),
      extract: (page && page.extract) || '',
    });
  }
  process.stderr.write(`\r  fetched ${Math.min(i + 20, puzzles.length)}/${puzzles.length}`);
  await sleep(300);
}
process.stderr.write('\n');

// ---- judge the finished, redacted clue ----
const results = puzzles.map((p) => {
  const i = info.get(p.id);
  const clue = i.extract ? sanitizeHint(i.extract, p.display, true) : '';
  // What a player actually has to work with, once the blanks are removed.
  const informative = clue.replace(/______/g, ' ').replace(/\s+/g, ' ').trim();
  let reason = null;
  if (i.missing) reason = 'NO WIKIPEDIA PAGE';
  else if (i.disambig) reason = 'DISAMBIGUATION PAGE';
  else if (!i.extract) reason = 'PAGE HAS NO INTRO TEXT';
  else if (/may (also )?refer to:?\s*$/i.test(clue)) reason = 'STUB "may refer to"';
  else if (informative.length < 40) reason = `CLUE TOO THIN AFTER REDACTION (${informative.length} chars)`;
  return { id: p.id, display: p.display, theme: p.themeCategory, wikiTitle: p.wikiTitle || null, clue, reason };
});

const bad = results.filter((r) => r.reason);
fs.writeFileSync(path.join(ROOT, 'scripts', 'propernoundle-validation.json'), JSON.stringify(results, null, 1));
if (process.argv.includes('--json')) { console.log(JSON.stringify(bad, null, 1)); }
else {
  console.log(`\n${puzzles.length} entries checked, ${bad.length} FAIL\n`);
  for (const r of bad) {
    console.log(`  ${r.id.padEnd(9)} ${r.display.padEnd(30)} ${r.theme.padEnd(14)} ${r.reason}`);
    if (r.clue) console.log(`            clue: "${r.clue.slice(0, 110)}"`);
  }
}
process.exit(bad.length ? 1 : 0);
