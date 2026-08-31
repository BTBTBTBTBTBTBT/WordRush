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

const solutions = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'solutions.json'), 'utf8'));
const legacy = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'solutions-legacy.json'), 'utf8'));
const words = [...new Set([...solutions, ...legacy].map((w) => w.toLowerCase()))].sort();

// Resume: keep everything already fetched (entries AND recorded misses).
let db = {};
if (fs.existsSync(OUT)) db = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const done = new Set(Object.keys(db));
const todo = words.filter((w) => !done.has(w));
console.log(`total ${words.length}, done ${done.size}, todo ${todo.length}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWord(word, attempt = 1) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    if (res.status === 404) return { miss: true }; // no dictionary entry — record so we skip it
    if (res.status === 429) {
      if (attempt > 5) return null;
      const wait = 60_000 * attempt;
      console.log(`  429 on ${word}; backing off ${wait / 1000}s`);
      await sleep(wait);
      return fetchWord(word, attempt + 1);
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
    if (attempt > 5) return null;
    await sleep(5_000 * attempt);
    return fetchWord(word, attempt + 1);
  }
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
