// Content safety — the ONE module every content guard (apps/web/scripts/content-check.test.ts,
// packages/core/src/answer-pool-hygiene.test.ts) and every bank generator (apps/web/scripts/**) uses to
// decide whether a word or a line of puzzle text may ship (docs/CONTENT-SAFETY.md). Plain ESM so the
// Node generators (.mjs) and the vitest suites share it without a build step; types in safety.d.mts.
// Build-time only — no app imports it at runtime, so there are no Swift/Kotlin ports.
//
// Data (packages/core/src/content-safety/data, rebuilt by scripts/build-content-safety-data.py):
//   offensive.json   exact words, substring roots, phrase patterns, and "contextual" words that are fine in a puzzle
//                    — all base64-encoded, decoded here at load time
//   british.json     British spellings, British-only vocabulary, British idiom patterns
//   obscure.json     curated obscure/archaic/jargon words + the Zipf threshold for "rare"
//   must-accept.json everyday words every accept list must contain where they fit
//   frequency.json   wordfreq 3.1.1 English Zipf×10, bucketed (data CC BY-SA 4.0)
import { readFileSync } from 'node:fs';

const load = (name) => JSON.parse(readFileSync(new URL(`./data/${name}.json`, import.meta.url), 'utf8'));
/** offensive.json is stored base64-encoded (policy: no offensive word in plain text in the repo's own files). */
const unb64 = (xs) => xs.map((x) => Buffer.from(x, 'base64').toString('utf8'));
let cache = null;
function data() {
  if (cache) return cache;
  const off = load('offensive'), brit = load('british'), obs = load('obscure'), must = load('must-accept'), freqB = load('frequency');
  const freq = new Map();
  for (const [z, words] of Object.entries(freqB)) for (const w of words.split(' ')) freq.set(w, Number(z) / 10);
  cache = {
    exact: new Set(unb64(off.exact)), roots: unb64(off.roots), rootExempt: new Set(off.rootExempt ?? []), offPhrases: unb64(off.phrases).map((p) => new RegExp(p, 'i')), contextual: new Set(unb64(off.contextual)),
    britSpell: new Set(brit.spellings), britWords: new Set(brit.words), britPhrases: brit.phrases.map((p) => new RegExp(`\\b${p}\\b`, 'i')),
    obscure: new Set(obs.words), zipfThreshold: obs.zipfThreshold, must: must.words, mustSet: new Set(must.words), freq,
  };
  return cache;
}

const LEET = { 0: 'O', 1: 'I', 3: 'E', 4: 'A', 5: 'S', 7: 'T', '@': 'A', $: 'S', '!': 'I' };
/** Upper-case letters only, with common leetspeak folded back to letters (5*** → S***). */
export function normalizeWord(w) {
  const u = String(w).toUpperCase();
  if (!/[A-Z]/.test(u)) return ''; // a bare number ("2455") is never a word
  return [...u].map((c) => LEET[c] ?? c).join('').replace(/[^A-Z]/g, '');
}
/** Masked form for reports and messages: first letter + asterisks (an offensive word is never printed). */
export function mask(w) { const u = normalizeWord(w); return u ? u[0] + '*'.repeat(u.length - 1) : ''; }
/** The word tokens of a line of text (clue, caption, saying, label), possessive 'S dropped. */
export function tokens(text) { return (String(text).match(/[A-Za-z0-9@$!][A-Za-z0-9@$!'-]*/g) ?? []).map((t) => normalizeWord(t.replace(/'s$/i, ''))).filter(Boolean); }

/**
 * Why a single WORD is offensive (profanity, slur, sexual, drug, violent, hate), or null. Exact list match
 * (minus the contextual words), or a hard root inside the word (F*****, S*****), after leet folding.
 */
export function offensiveWord(word) {
  const d = data(), w = normalizeWord(word);
  if (!w) return null;
  if (d.exact.has(w) && !d.contextual.has(w)) return `blocked word ${mask(w)}`;
  const root = d.rootExempt.has(w) ? null : d.roots.find((r) => w.includes(r));
  return root ? `contains ${mask(root)}` : null;
}
/** Why a line of TEXT is offensive, or null: an offensive token, or an offensive phrase ("A c**** in the ____"). */
export function offensiveText(text) {
  const d = data();
  const phrase = d.offPhrases.find((re) => re.test(text));
  if (phrase) return `offensive phrase (${tokens(phrase.source).map(mask).join(' ')})`;
  for (const t of tokens(text)) { const why = offensiveWord(t); if (why) return why; }
  return null;
}
/**
 * Leak scan for the repo's OWN files (code, tests, reports, commit text): every token that is offensive,
 * masked. The content gate runs it over every file the content tooling owns, so a blocklisted word can
 * never be written in plain text there again.
 */
export function leaks(text) {
  const out = new Set();
  for (const t of tokens(text)) if (offensiveWord(t)) out.add(mask(t));
  return [...out];
}
/** isOffensive(word or text). */
export function isOffensive(s) { return /\s/.test(String(s).trim()) ? offensiveText(s) !== null : offensiveWord(s) !== null; }

/** Why a WORD is British-only (spelling or vocabulary), or null. */
export function britishWord(word) {
  const d = data(), w = normalizeWord(word);
  if (d.britSpell.has(w)) return `British spelling ${w}`;
  if (d.britWords.has(w)) return `British word ${w}`;
  return null;
}
/** Why a line of TEXT is British-only, or null: a British token or a British idiom ("Pull your socks up"). */
export function britishText(text) {
  const d = data();
  const p = d.britPhrases.find((re) => re.test(text));
  if (p) return `British phrase /${p.source.slice(2, -2)}/`;
  for (const t of tokens(text)) { const why = britishWord(t); if (why) return why; }
  return null;
}
export function isBritishOnly(s) { return /\s/.test(String(s).trim()) ? britishText(s) !== null : britishWord(s) !== null; }

/** wordfreq Zipf (0 when rarer than 2.0 / unknown). */
export function zipf(word) { return data().freq.get(normalizeWord(word)) ?? 0; }
/** On the curated obscure/archaic/jargon list (a hard failure for answers, required words and rungs). */
export function isListedObscure(word) { return data().obscure.has(normalizeWord(word)); }
/** isObscure: curated list, or rarer than the Zipf threshold (default 2.5) — the latter is a warning-level signal. */
export function isObscure(word, threshold = data().zipfThreshold) { return isListedObscure(word) || zipf(word) < threshold; }

/** Everyday words that must be accepted wherever they fit (05b). */
export function mustAccept() { return data().must; }
export function isMustAccept(word) { return data().mustSet.has(normalizeWord(word)); }

/**
 * Generator gate: problems with using `word` as an answer / required word / rung, or [] when fine.
 * opts.obscure=false skips the obscure checks (accept lists may carry rare-but-real words).
 */
export function wordProblems(word, { obscure = true, minZipf = 0 } = {}) {
  const out = [];
  const off = offensiveWord(word); if (off) out.push(off);
  const brit = britishWord(word); if (brit) out.push(brit);
  if (obscure && isListedObscure(word)) out.push(`obscure ${normalizeWord(word)}`);
  if (minZipf && zipf(word) < minZipf) out.push(`rare (zipf ${zipf(word)})`);
  return out;
}
/** Generator gate for clue / caption / saying text. */
export function textProblems(text) {
  const out = [];
  const off = offensiveText(text); if (off) out.push(off);
  const brit = britishText(text); if (brit) out.push(brit);
  return out;
}
