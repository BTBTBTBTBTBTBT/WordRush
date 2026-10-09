import { describe, it, expect, afterAll } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { applyAllSolutionSwaps } from '@wordle-duel/core';
import { CONTENT_RELEASE_DATE } from './content-release-date.mjs';
import * as safety from '../../../packages/core/src/content-safety/safety.mjs';
import { servedEntries, sha } from '../../../packages/core/src/content-safety/served.mjs';
import { ALLOW, bankItems, itemProblems, unseenEntries } from '../../../packages/core/src/content-safety/gate.mjs';

/**
 * THE CONTENT GATE (prompt 05c, docs/CONTENT-SAFETY.md) — `npm run content:check`, and part of every CI run
 * (apps/web vitest). Every bank / answer pool / accept list / clue file of every game is registered in
 * packages/core/src/content-safety/registry.json; registering a file applies every guard below to it, and a
 * bank-like JSON file that is NOT registered fails the gate, so a new game cannot ship an unchecked list.
 *
 * Scope: what a player has NOT seen yet — dailies from CONTENT_RELEASE_DATE, the Unlimited pools, holiday
 * entries not yet served — plus the answer pools AS DEALT once every swap batch is live, and the accept
 * lists. Served content never changes (G10 proves it against served-snapshot.json).
 *
 *  G1  offensive (profanity, slurs, sexual, drug, violent, hate; leet-folded) — answers, required words,
 *      rungs, accept lists and every line of text (clues with the blank filled, captions, sayings, labels)
 *  G2  British-only spelling / vocabulary / idiom — answers, required words, rungs, text
 *  G3  Kindred: no group repeated word for word        G4  Codebreaker: no saying twice
 *  G5  Crosswordocious: no word stem twice in one grid G6  ProperNoundle: rotation ∩ holidays = ∅
 *  G7  curated obscure words — never an answer, required word, rung, Kindred or Spyglass word
 *  G8  must-accept everyday words (AUNT, AUNTY, NIECE…) accepted wherever they fit
 *  G9  registry complete; web / iOS / Android copies byte-identical
 *  G10 already-served entries unchanged (served-snapshot.json)
 *  G11 no offensive word in plain text in the content tooling's own files (code, tests, data, reports)
 *  G12 the registry's length rule: every list word / answer / required word / rung is A–Z within [min, max]
 * A legit exception goes in content-safety/data/allow.json with its reason. Rarer-than-Zipf-2.5 words are reported, not failed.
 * Offensive words are only ever printed MASKED (first letter + asterisks); ALLOW keys never spell them.
 */
const REPO = join(__dirname, '..', '..', '..');
const CS = join(REPO, 'packages', 'core', 'src', 'content-safety');
const J = (p: string) => JSON.parse(readFileSync(join(REPO, p), 'utf8'));
type Bank = { id: string; games: string[]; kind: string; schema: string; web: string; copies: string[]; lengths?: number[] };
const registry = JSON.parse(readFileSync(join(CS, 'registry.json'), 'utf8')) as {
  scan: string[]; banks: Bank[]; sources: { id: string; paths: string[] }[]; notContent: Record<string, string>;
};
const bank = (id: string) => registry.banks.find((b) => b.id === id)!;
const holidayDays: Record<string, string> & { __pnHoliday?: Set<string> } = J('apps/web/data/holiday-days.json').days;

// Reasoned exceptions live in packages/core/src/content-safety/data/allow.json (shared with the generators' gate).

// ---------------------------------------------------------------- scope
type Entry = { id: string; where: string; p: any };
const unseen = (b: any): Entry[] => unseenEntries(b, { from: CONTENT_RELEASE_DATE, holidayDays });
const servedHoliday = (key: string, i: number, n: number) => Object.keys(holidayDays).filter((d) => holidayDays[d] === key).sort()
  .filter((_, k) => k % n === i).some((d) => d >= '2026-09-23' && d < CONTENT_RELEASE_DATE);
const up = (ws: string[]) => ws.map((w) => w.toUpperCase());

/** Per-bank: the words that are answers (shown / required), the words merely accepted, and the lines of text a player reads. */
type Item = { bank: string; id: string; where: string; words: string[]; accepted?: string[]; sized?: string[]; texts: string[] };
const items: Item[] = [];
for (const id of ['crossword', 'codebreaker', 'kindred', 'hubbub', 'ladder', 'muddle', 'spyglass']) {
  items.push(...(bankItems(id, J(bank(id).web), { from: CONTENT_RELEASE_DATE, holidayDays }) as Item[]));
}
const themes = J(bank('spyglass-themes').web).themes as { key: string; title: string; words: string }[];
for (const t of themes) items.push({ bank: 'spyglass-themes', id: t.key, where: 'theme pool', words: t.words.split(/\s+/), texts: [t.title] });
for (const id of ['answers-5', 'answers-6', 'answers-7']) items.push({ bank: id, id: 'pool', where: 'as dealt after every swap batch', words: applyAllSolutionSwaps(up(J(bank(id).web))), texts: [] });
const ha = J(bank('holiday-answers').web) as Record<string, Record<string, string[]>>;
for (const [k, v] of Object.entries(ha)) items.push({ bank: 'holiday-answers', id: k, where: 'unshipped table', words: Object.values(v).flat(), texts: [] });

/** Words the founder has not ruled on yet (answer-pool-hygiene.test.ts PENDING_FOUNDER_CALL) — reported, never failed. */
const hygiene = readFileSync(join(REPO, 'packages', 'core', 'src', 'answer-pool-hygiene.test.ts'), 'utf8');
const PENDING = new Set([...hygiene.slice(hygiene.indexOf('PENDING_FOUNDER_CALL = new Set(['), hygiene.indexOf(']);', hygiene.indexOf('PENDING_FOUNDER_CALL'))).matchAll(/'([A-Z]+)'/g)].map((m) => m[1]));

const report: string[] = [];
const ok = (key: string) => key in ALLOW;
const fmt = (hits: string[]) => `${hits.length} hit(s):\n${hits.slice(0, 40).join('\n')}`;
const started = Date.now();

describe('content gate (npm run content:check)', () => {
  it('G9 registry: every bank-like file is registered, and every copy is byte-identical to the web file', () => {
    const registered = new Set([...registry.banks.flatMap((b) => [b.web, ...b.copies])]);
    const sourceGlobs = registry.sources.flatMap((s) => s.paths);
    const glob = (pattern: string) => {
      const dir = pattern.slice(0, pattern.lastIndexOf('/')); const file = pattern.slice(pattern.lastIndexOf('/') + 1);
      const dirs = dir.includes('*') ? (() => { const [a, b] = dir.split('/*'); return existsSync(join(REPO, a)) ? readdirSync(join(REPO, a), { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => `${a}/${d.name}${b}`) : []; })() : [dir];
      const re = new RegExp(`^${file.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`);
      return dirs.flatMap((d) => (existsSync(join(REPO, d)) ? readdirSync(join(REPO, d)).filter((n) => re.test(n)).map((n) => `${d}/${n}`) : []));
    };
    const sourceFiles = new Set(sourceGlobs.flatMap(glob));
    const notContent = Object.keys(registry.notContent).map((k) => new RegExp(`^${k.replace(/[.]/g, '\\.').replace(/\*/g, '.*')}$`));
    const unregistered = registry.scan.flatMap(glob).filter((f) => !registered.has(f) && !sourceFiles.has(f) && !notContent.some((re) => re.test(f.split('/').pop()!)));
    expect(unregistered, `register these in packages/core/src/content-safety/registry.json (or list them under notContent with a reason):\n${unregistered.join('\n')}`).toEqual([]);
    const hash = (p: string) => createHash('sha256').update(readFileSync(join(REPO, p))).digest('hex');
    const drift: string[] = [];
    for (const b of registry.banks) { expect(existsSync(join(REPO, b.web)), b.web).toBe(true); for (const c of b.copies) if (!existsSync(join(REPO, c)) || hash(c) !== hash(b.web)) drift.push(`${c} ≠ ${b.web}`); }
    expect(drift, `copy the web file over these (cp ${'<web> <copy>'}):\n${drift.join('\n')}`).toEqual([]);
    report.push(`G9  registry: ${registry.banks.length} shipped files (${registry.banks.reduce((n, b) => n + b.copies.length, 0)} platform copies) + ${sourceFiles.size} generator sources; 0 unregistered, 0 drift`);
  });

  it('G10 already-served entries are unchanged (served-snapshot.json)', () => {
    const snap = JSON.parse(readFileSync(join(CS, 'served-snapshot.json'), 'utf8')) as { from: string; banks: Record<string, Record<string, string>> };
    expect(snap.from <= CONTENT_RELEASE_DATE, 'snapshot newer than CONTENT_RELEASE_DATE').toBe(true);
    holidayDays.__pnHoliday = new Set(Object.keys(J('apps/web/data/propernoundle-holidays.json').holiday));
    const changed: string[] = []; let n = 0;
    for (const [id, entries] of Object.entries(snap.banks)) {
      const b = bank(id), now = new Map(servedEntries(b.schema, J(b.web), { from: snap.from, holidayDays }).map((e: { key: string; value: unknown }) => [e.key, sha(e.value)]));
      for (const [key, h] of Object.entries(entries)) { n++; if (now.get(key) !== h) changed.push(`${id} ${key}`); }
    }
    expect(changed, `served content changed — never edit a puzzle players already had:\n${changed.join('\n')}`).toEqual([]);
    report.push(`G10 served: ${n} served entries / pools hashed before ${snap.from}; 0 changed`);
  });

  // G1 / G2 / G7 are the generators' own gate (content-safety/gate.mjs itemProblems), over every item here plus
  // the Letter Ladder accept list (shown as hints, so British / obscure rules apply to it too).
  const ladderItem = (): Item => ({ bank: 'ladder-accept', id: 'list', where: 'accept list', words: up(J(bank('ladder-accept').web)), texts: [] });
  let problems: ReturnType<typeof itemProblems> | undefined;
  const gate = () => (problems ??= itemProblems([...items, ladderItem()], { skipOffensive: PENDING }));

  it('G1 nothing offensive in answers, required words, rungs, accept lists or text', () => {
    // The Classic / Six / Seven GUESS lists are monotonic — removing a guess rewrites every finished game that
    // used it (word-list-sync.test.ts) — so they keep that test's slur rule; additions go through G8's filter.
    const hits = gate().g1;
    report.push(`G1  offensive: ${hits.length} hit(s)`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G2 nothing British-only in answers, required words, rungs or text', () => {
    const hits = gate().g2;
    report.push(`G2  British: ${hits.length} hit(s)`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G3 Kindred: no group repeated word for word anywhere in the bank', () => {
    const b = J(bank('kindred').web), seen = new Map<string, string>(), hits: string[] = [];
    const all = [...b.daily.map((p: any, i: number) => ({ p, i })), ...b.extra.map((p: any) => ({ p, i: Infinity })), ...Object.values(b.holiday as Record<string, any[]>).flat().map((p) => ({ p, i: Infinity }))];
    const live = new Set(unseen(b).map((e) => e.id));
    for (const { p } of all) for (const g of p.groups) {
      const k = [...g.words].sort().join(' ');
      if (seen.has(k) && live.has(p.id) && !ok(`G3:kindred:${p.id}:${g.label}`)) hits.push(`${p.id}: "${g.label}" ${k} — also ${seen.get(k)}`);
      if (!seen.has(k)) seen.set(k, p.id);
    }
    report.push(`G3  Kindred duplicate groups: ${hits.length}`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G4 Codebreaker: no saying twice', () => {
    const b = J(bank('codebreaker').web), hits: string[] = [];
    const norm = (t: string) => t.toLowerCase().replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
    const keys = (t: string) => [norm(t), `tail:${norm(t).split(' ').slice(-4).join(' ')}`];
    const where = new Map<string, string[]>();
    for (const q of [...b.daily, ...b.extra, ...Object.values(b.holiday as Record<string, any[]>).flat()]) for (const k of keys(q.text)) where.set(k, [...(where.get(k) ?? []), q.id]);
    for (const e of unseen(b)) for (const k of keys(e.p.text)) if (where.get(k)!.length > 1 && !ok(`G4:codebreaker:${e.id}:${k}`)) { hits.push(`${e.id} "${e.p.text}" ~ ${where.get(k)!.filter((x) => x !== e.id).join(', ')}`); break; }
    report.push(`G4  Codebreaker duplicate sayings: ${hits.length}`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G5 Crosswordocious: no word stem twice in one grid', () => {
    const hits: string[] = [];
    for (const e of unseen(J(bank('crossword').web))) {
      const ans: string[] = e.p.entries.map((x: any) => x.answer);
      for (const a of ans) for (const b of ans) if (a !== b && a.length >= 3 && b.startsWith(a) && /^(S|ES|D|ED|ER|ERS|ING|LY|Y)$/.test(b.slice(a.length)) && !ok(`G5:crossword:${e.id}:${a}/${b}`)) hits.push(`${e.id} (${e.where}): ${a} / ${b}`);
    }
    report.push(`G5  Crossword stem repeats: ${hits.length} (+ ${Object.keys(ALLOW).filter((k) => k.startsWith('G5:')).length} allowed, awaiting grid rebuilds)`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G6 ProperNoundle: no unserved holiday answer repeats the daily rotation', () => {
    const rot = new Set((J(bank('propernoundle').web) as any[]).map((p) => p.answer));
    const hol = J(bank('propernoundle-holidays').web).holiday as Record<string, any[]>;
    const hits = Object.entries(hol).flatMap(([k, l]) => l.filter((p, i) => rot.has(p.answer) && !servedHoliday(k, i, l.length)).map((p) => `${k} ${p.id}: ${p.display}`));
    report.push(`G6  ProperNoundle rotation ∩ holidays: ${hits.length}`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G7 no curated-obscure word as an answer, required word, rung, Kindred or Spyglass word', () => {
    const { g7: hits, rare } = gate();
    report.push(`G7  curated obscure: ${hits.length} hit(s) (+ ${Object.keys(ALLOW).filter((k) => k.startsWith('G7:')).length} allowed); warning only — ${new Set(rare).size} distinct shown/required words rarer than Zipf 2.5`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  it('G8 everyday words (AUNT, AUNTY, NIECE…) are accepted wherever they fit', () => {
    const must = safety.mustAccept().filter((w) => !safety.offensiveWord(w));
    const missing: string[] = [];
    for (const [id, len] of [['accept-5', 5], ['accept-6', 6], ['accept-7', 7], ['ladder-accept', 5]] as const) {
      const set = new Set(up(J(bank(id).web)));
      for (const w of must) if (w.length === len && !set.has(w)) missing.push(`${id}: ${w}`);
    }
    let checked = 0;
    for (const e of unseen(J(bank('hubbub').web))) {
      const letters = new Set(e.p.letters as string), centre = e.p.letters[0];
      const accepted = new Set([...e.p.words, ...e.p.bonus]);
      for (const w of must) if (w.length >= 4 && [...w].every((c) => letters.has(c)) && w.includes(centre)) { checked++; if (!accepted.has(w)) missing.push(`hubbub ${e.id} (${e.p.letters}): ${w}`); }
    }
    report.push(`G8  must-accept: ${must.length} everyday words × 4 accept lists + ${checked} Hubbub fits; ${missing.length} missing`);
    expect(missing, fmt(missing)).toEqual([]);
  });

  it('G11 no offensive word in plain text in the content tooling\'s own files', () => {
    const owned = [
      'packages/core/src/content-safety', 'apps/web/scripts/content-fixes', 'apps/web/scripts/data',
      'apps/web/scripts/content-check.test.ts', 'apps/web/scripts/content-sync.mjs', 'apps/web/scripts/content-snapshot.mjs',
      'scripts/build-content-safety-data.py', 'REPORT-CONTENT-AUDIT.md', 'REPORT-CONTENT-FIXES.md', 'content-audit.json', 'docs/CONTENT-SAFETY.md',
    ];
    const walk = (p: string): string[] => { const abs = join(REPO, p); if (!existsSync(abs)) return []; return statSync(abs).isDirectory() ? readdirSync(abs).flatMap((n) => walk(join(p, n))) : [p]; };
    const files = owned.flatMap(walk);
    // Batch 4 of the answer swaps keeps its offensive keys base64-encoded; scan that section of all three ports.
    const sections: [string, string, string][] = [
      ['packages/core/src/solution-swaps.ts', 'Batch 4 (content audit', 'applySolutionSwaps4'],
      ['apps/ios/Sources/Core/SolutionSwaps.swift', 'Batch 4 (content audit', 'applySolutionSwaps4'],
      ['apps/android/core/src/main/kotlin/com/wordocious/core/SolutionSwaps.kt', 'Batch 4 (content audit', 'applySolutionSwaps4'],
    ];
    const hits: string[] = [];
    for (const f of files) { if (f.endsWith('frequency.json')) continue; const l = safety.leaks(readFileSync(join(REPO, f), 'utf8')); if (l.length) hits.push(`${f}: ${l.join(' ')}`); }
    for (const [f, a, b] of sections) { const t = readFileSync(join(REPO, f), 'utf8'); const l = safety.leaks(t.slice(t.indexOf(a), t.indexOf(b))); if (l.length) hits.push(`${f} (batch 4): ${l.join(' ')}`); }
    report.push(`G11 plain-text leak scan: ${files.length + sections.length} files/sections, ${hits.length} with a leak`);
    expect(hits, `store these base64-encoded (see docs/CONTENT-SAFETY.md):\n${hits.join('\n')}`).toEqual([]);
  });

  it('G12 length rules: every registered list word, answer, required word and rung is A–Z within the registry\'s [min, max]', () => {
    const hits: string[] = []; let n = 0;
    const check = (b: Bank, where: string, ws: string[]) => {
      const [min, max] = b.lengths!.length === 1 ? [b.lengths![0], b.lengths![0]] : b.lengths!;
      for (const w of ws) { n++; if (!/^[A-Z]+$/.test(w) || w.length < min || w.length > max) hits.push(`${b.id} ${where}: ${safety.offensiveWord(w) ? safety.mask(w) : w} (${w.length})`); }
    };
    for (const b of registry.banks.filter((x) => x.lengths)) {
      if (b.schema === 'epoch-bank') for (const it_ of items.filter((x) => x.bank === b.id)) check(b, `${it_.id} (${it_.where})`, it_.sized ?? []);
      else check(b, 'list', up(J(b.web)));
    }
    report.push(`G12 lengths: ${n} words in ${registry.banks.filter((x) => x.lengths).length} registered files; ${hits.length} out of range`);
    expect(hits, fmt(hits)).toEqual([]);
  });

  afterAll(() => {
    // The readable report `npm run content:check` prints.
    console.log(['', `CONTENT GATE — release date ${CONTENT_RELEASE_DATE}; ${items.length} unseen puzzles / pools / tables checked in ${((Date.now() - started) / 1000).toFixed(1)}s`, ...report, ''].join('\n'));
  });
});
