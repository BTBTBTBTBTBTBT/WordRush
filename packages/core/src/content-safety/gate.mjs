// The content gate's per-bank rules, shared by the CI gate (apps/web/scripts/content-check.test.ts, G1/G2/G7)
// and by every puzzle generator (gateBank before a bank is written), so a bad word is rejected when a puzzle
// is CREATED, not found later. See docs/CONTENT-SAFETY.md.
//
// Scope is what a player has not seen yet: dailies dated on/after `from` (CONTENT_RELEASE_DATE), the
// Unlimited pool, and holiday entries never served — the same rule as bank.ts (entry k of a holiday serves
// that holiday's outings ≡ k mod n). Served entries are frozen (served-snapshot.json) and never re-judged.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './safety.mjs';
import { BANK_EPOCH } from './served.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(HERE, '..', '..', '..', '..');
const DAY = 86400000;

/** Reasoned exceptions, `${guard}:${bankId}:${puzzleId}:${WORD | text}` → why (offensive words keyed masked). */
export const ALLOW = Object.assign({}, ...Object.values(JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'allow.json'), 'utf8')).groups));
export const allowed = (key) => key in ALLOW;

let defaults;
/** CONTENT_RELEASE_DATE and the holiday calendar, read from apps/web (the canonical copies). */
export async function gateDefaults() {
  if (!defaults) {
    const { CONTENT_RELEASE_DATE } = await import(path.join(REPO, 'apps', 'web', 'scripts', 'content-release-date.mjs'));
    defaults = { from: CONTENT_RELEASE_DATE, holidayDays: JSON.parse(fs.readFileSync(path.join(REPO, 'apps', 'web', 'data', 'holiday-days.json'), 'utf8')).days };
  }
  return defaults;
}

/** Entries of an epoch bank ({ daily, extra?, holiday? }) a player has not seen before `from`: [{ id, where, p }]. */
export function unseenEntries(bank, { from, holidayDays }) {
  const first = Math.max(0, Math.round((Date.parse(`${from}T00:00:00Z`) - Date.parse(`${BANK_EPOCH}T00:00:00Z`)) / DAY));
  const served = (key, i, n) => Object.keys(holidayDays).filter((d) => holidayDays[d] === key).sort()
    .filter((_, k) => k % n === i).some((d) => d >= BANK_EPOCH && d < from);
  return [
    ...bank.daily.slice(first).map((p, i) => ({ id: p.id, where: `daily#${first + i}`, p })),
    ...(bank.extra ?? []).map((p, i) => ({ id: p.id, where: `unlimited#${i}`, p })),
    ...Object.entries(bank.holiday ?? {}).flatMap(([k, l]) => l.map((p, i) => ({ id: p.id, where: `holiday:${k}#${i}`, p, i, n: l.length }))
      .filter((e) => !served(k, e.i, e.n)).map(({ id, where, p }) => ({ id, where, p }))),
  ];
}

/**
 * Per registered bank: the words a player must find or is shown (answers, required words, rungs), the words
 * merely ACCEPTED (offensive check only — British forms are fine to type), every line of text read, and the
 * words the registry's `lengths` rule applies to (`sized`; G12).
 * A new game adds its extractor here (and its files to registry.json).
 */
export const EXTRACT = {
  crossword: (p) => ({ words: p.entries.map((x) => x.answer), sized: p.entries.map((x) => x.answer), texts: [p.title, ...p.entries.map((x) => x.clue.replace('____', x.answer.toLowerCase()))] }),
  codebreaker: (p) => ({ words: [], texts: [p.text] }),
  kindred: (p) => ({ words: p.groups.flatMap((g) => g.words), sized: p.groups.flatMap((g) => g.words), texts: p.groups.map((g) => g.label) }),
  hubbub: (p) => ({ words: p.words, accepted: p.bonus, sized: [...p.words, ...p.bonus], texts: [] }),
  ladder: (p) => ({ words: [p.start, p.end, ...p.path], sized: [p.start, p.end, ...p.path], texts: [] }),
  muddle: (p) => ({ words: [...p.words.map((w) => w.answer), ...p.final.answer.split(' ')], sized: p.words.map((w) => w.answer), texts: [p.caption.replace('____', p.final.answer.toLowerCase()), p.altText] }),
  spyglass: (p) => ({ words: p.words.map((w) => w.w), sized: p.words.map((w) => w.w), texts: [p.title] }),
};
/** Registry ids → extractor (generators name their bank by registry id or by game folder). */
const ALIAS = { scramble: 'muddle', groups: 'kindred', cryptogram: 'codebreaker', hub: 'hubbub', wordsearch: 'spyglass' };

/** Items ({ bank, id, where, words, accepted, texts }) of a bank's unseen entries. */
export function bankItems(bankId, bank, opts) {
  const id = ALIAS[bankId] ?? bankId, x = EXTRACT[id];
  if (!x) throw new Error(`content gate: no extractor for bank "${bankId}" — add one to packages/core/src/content-safety/gate.mjs`);
  return unseenEntries(bank, opts).map((e) => ({ bank: id, id: e.id, where: e.where, accepted: [], sized: [], ...x(e.p) }));
}

/**
 * The word / text rules over items: G1 offensive (words, accepted words, text), G2 British-only (words, text),
 * G7 curated obscure (words; crossword fill is clued, so rarer fill is fair there). `skipOffensive` holds words
 * the founder has not ruled on yet (reported elsewhere, never failed). Offensive words are reported masked.
 */
export function itemProblems(items, { skipOffensive = new Set() } = {}) {
  const g1 = [], g2 = [], g7 = [], rare = [];
  for (const it of items) {
    const at = `${it.bank} ${it.id} (${it.where})`;
    for (const w of it.words) {
      const off = S.offensiveWord(w);
      if (off && !skipOffensive.has(w) && !allowed(`G1:${it.bank}:${it.id}:${S.mask(w)}`)) g1.push(`${at}: ${off}`);
      const brit = S.britishWord(w);
      if (brit && !allowed(`G2:${it.bank}:${it.id}:${w}`)) g2.push(`${at}: ${brit}`);
      if (it.bank === 'crossword') continue;
      if (S.isListedObscure(w) && !allowed(`G7:${it.bank}:${it.id}:${w}`)) g7.push(`${at}: ${off ? S.mask(w) : w}`);
      else if (w.length >= 4 && S.zipf(w) < 2.5 && it.bank !== 'muddle') rare.push(`${it.bank}:${w}`);
    }
    for (const w of it.accepted ?? []) { const off = S.offensiveWord(w); if (off) g1.push(`${at} accepted: ${off}`); }
    for (const t of it.texts) {
      const off = S.offensiveText(t);
      if (off && !allowed(`G1:${it.bank}:${it.id}:text`)) g1.push(`${at}: ${off}`);
      const brit = S.britishText(t);
      if (brit && !allowed(`G2:${it.bank}:${it.id}:text`)) g2.push(`${at}: "${S.leaks(t).length ? '(masked)' : t.slice(0, 70)}" — ${brit}`);
    }
  }
  return { g1, g2, g7, rare };
}

/**
 * Generators call this right before writing a bank: throws (with masked words) when any unseen puzzle has an
 * offensive, British-only or curated-obscure word or line. Returns the number of puzzles checked.
 */
export async function gateBank(bankId, bank, opts) {
  const items = bankItems(bankId, bank, opts ?? await gateDefaults());
  const { g1, g2, g7 } = itemProblems(items);
  const all = [...g1.map((h) => `offensive  ${h}`), ...g2.map((h) => `British    ${h}`), ...g7.map((h) => `obscure    ${h}`)];
  if (all.length) throw new Error(`content gate refused the ${bankId} bank (${all.length} problem(s); fix the generator or see docs/CONTENT-SAFETY.md):\n${all.slice(0, 40).join('\n')}`);
  return items.length;
}

/** For candidate lists outside a bank (sample runs, word pools): the words/lines that fail, masked. */
export function wordRejects(words, opts) { return words.filter((w) => S.wordProblems(w, opts).length).map((w) => (S.offensiveWord(w) ? S.mask(w) : w)); }
export function textRejects(texts) { return texts.filter((t) => S.textProblems(t).length).map((t) => (S.leaks(t).length ? '(masked line)' : t)); }
