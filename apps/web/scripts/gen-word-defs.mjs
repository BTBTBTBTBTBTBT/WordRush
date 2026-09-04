#!/usr/bin/env node
/**
 * One-time (re-runnable, resumable) generator for data/word-definitions.json —
 * the local dictionary that backs /word/[date] and /words.
 *
 * Why: those pages used to call dictionaryapi.dev AT RENDER TIME. The free API
 * rate-limits hard, so in production the lookups failed, definitions vanished,
 * and every archive page collapsed to a ~124-word stub — the exact "low value
 * content" AdSense kept rejecting. Fetching once here and committing the result
 * removes the runtime dependency entirely.
 *
 * Source: dictionaryapi.dev (aggregates Wiktionary, CC BY-SA — credited on the
 * page). Run: node scripts/gen-word-defs.mjs   (resumes if interrupted; words
 * with no entry are recorded as misses so page logic can skip them.)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'word-definitions.json');

// §250: victory cards show definitions in EVERY daily length — cover the
// Six/Seven pools (and their legacies) too, not just the 5-letter lists.
const LISTS = [
  'solutions.json', 'solutions-legacy.json',
  'solutions-6.json', 'solutions-6-legacy.json',
  'solutions-7.json', 'solutions-7-legacy.json',
];
const words = [...new Set(
  LISTS.flatMap((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'data', f), 'utf8')))
    .map((w) => w.toLowerCase()),
)].sort();

// Resume: keep everything already fetched (entries AND recorded misses).
let db = {};
if (fs.existsSync(OUT)) db = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const done = new Set(Object.keys(db));
const todo = words.filter((w) => !done.has(w));
console.log(`total ${words.length}, done ${done.size}, todo ${todo.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const timed = (ms) => AbortSignal.timeout(ms);

async function fetchPrimary(word, attempt = 1) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, { signal: timed(8_000) });
    if (res.status === 404) return { miss: true }; // no dictionary entry — record so we skip it
    if (res.status === 429) {
      if (attempt > 5) return null;
      const wait = 60_000 * attempt;
      console.log(`  429 on ${word}; backing off ${wait / 1000}s`);
      await sleep(wait);
      return fetchPrimary(word, attempt + 1);
    }
    if (!res.ok) return null;
    const data = await res.json();
    const entry = data?.[0];
    if (!entry) return { miss: true };
    const phonetic = entry.phonetics?.find((p) => p.text)?.text || entry.phonetic || '';
    const senses = (entry.meanings || [])
      .slice(0, 4)
      .map((m) => ({
        pos: m.partOfSpeech || '',
        def: m.definitions?.[0]?.definition || '',
        example: m.definitions?.[0]?.example || '',
        syn: (m.synonyms || []).slice(0, 6),
        ant: (m.antonyms || []).slice(0, 4),
      }))
      .filter((s) => s.def);
    if (!senses.length) return { miss: true };
    return { phonetic, senses };
  } catch (e) {
    return null; // no local retries — the fallback source handles a dead primary
  }
}

// Wiktionary REST fallback (dictionaryapi.dev is itself a Wiktionary aggregator,
// so this is the same CC BY-SA data from the horse's mouth — added during the
// 2026-08/09 outage when the aggregator was down for days). Definitions arrive
// as HTML; no phonetics/synonyms on this endpoint, which our page logic treats
// as optional anyway.
const stripHtml = (s) => (s || '')
  .replace(/<[^>]*>/g, '')
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/\s+/g, ' ')
  .trim();

async function fetchWiktionary(word, attempt = 1) {
  try {
    const res = await fetch(`https://en.wiktionary.org/api/rest_v1/page/definition/${word}`, {
      signal: timed(8_000),
      headers: { 'User-Agent': 'WordociousDefs/1.0 (https://wordocious.com)' },
    });
    if (res.status === 404) return { miss: true };
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data = await res.json();
    const senses = (data?.en || [])
      .slice(0, 4)
      .map((m) => {
        const d = m.definitions?.find((x) => stripHtml(x.definition));
        return {
          pos: (m.partOfSpeech || '').toLowerCase(),
          def: stripHtml(d?.definition),
          example: stripHtml(d?.parsedExamples?.[0]?.example || d?.examples?.[0] || ''),
          syn: [],
          ant: [],
        };
      })
      .filter((s) => s.def);
    if (!senses.length) return { miss: true };
    return { phonetic: '', senses };
  } catch (e) {
    if (attempt > 3) return null;
    await sleep(5_000 * attempt);
    return fetchWiktionary(word, attempt + 1);
  }
}

// Circuit breaker: after 3 straight primary failures, stop asking it at all —
// a dead primary must cost nothing per word, not an 8s timeout each.
let primaryStrikes = 0;
async function fetchWord(word) {
  if (primaryStrikes < 3) {
    const r = await fetchPrimary(word);
    if (r !== null) { primaryStrikes = 0; return r; }
    primaryStrikes++;
    if (primaryStrikes === 3) console.log('  primary source down — switching to Wiktionary REST');
  }
  return fetchWiktionary(word);
}

let fetched = 0;
for (const word of todo) {
  const result = await fetchWord(word);
  if (result === null) {
    console.log(`  transient failure on ${word}; leaving for a re-run`);
  } else {
    db[word] = result;
    fetched++;
  }
  if (fetched % 25 === 0) fs.writeFileSync(OUT, JSON.stringify(db)); // checkpoint
  await sleep(1100); // ~0.9 req/s — polite, stays far under the rate limit
}
fs.writeFileSync(OUT, JSON.stringify(db));

// §250: the natives bundle the same dataset — keep the copies in step.
const NATIVE_COPIES = [
  path.join(ROOT, '..', 'ios', 'Wordocious', 'Resources', 'word-definitions.json'),
  path.join(ROOT, '..', 'android', 'app', 'src', 'main', 'assets', 'word-definitions.json'),
];
for (const dest of NATIVE_COPIES) {
  try { fs.copyFileSync(OUT, dest); console.log(`synced ${dest}`); } catch (e) { console.log(`sync failed: ${dest}: ${e.message}`); }
}

const misses = Object.values(db).filter((v) => v.miss).length;
console.log(`finished: ${Object.keys(db).length} recorded (${misses} misses), wrote ${OUT}`);
