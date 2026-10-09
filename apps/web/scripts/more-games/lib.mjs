// Shared helpers for the OFFLINE More Games generators (Phase 0 onwards).
// simpleHash + mulberry32 mirror packages/core/src/seed.ts exactly so anything
// seeded here can later be re-derived by the three engines if ever needed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { wordProblems, offensiveWord, offensiveText } from '../../../../packages/core/src/content-safety/safety.mjs';

export const WEB = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const REPO = path.join(WEB, '..', '..');
export const DATA = path.join(WEB, 'data');
export const SAMPLES = path.join(REPO, 'scripts', 'out', 'more-games-samples');

export function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) { hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0; }
  return Math.abs(hash);
}
export function mulberry32(seedValue) {
  let a = seedValue | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) ^ t;
    return (t ^ (t >>> 14)) >>> 0;
  };
}
export const rngFor = (label) => mulberry32(simpleHash(label));
export const below = (rng, n) => rng() % n;
export function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = below(rng, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export const readJSON = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
export const upperList = (file) => readJSON(path.join(DATA, file)).map((w) => w.toUpperCase());
export function wordset(file) {
  const p = path.join(REPO, 'scripts', 'data', file);
  if (!fs.existsSync(p)) return new Set();
  return new Set(fs.readFileSync(p, 'utf8').split('\n').map((l) => l.trim().toUpperCase()).filter((l) => l && !l.startsWith('#')));
}
/**
 * Words that must never be an answer/endpoint/list word in any More Games bank: the blocklists here, PLUS
 * anything the shared content-safety module rejects (offensive incl. roots/leet, British-only, curated obscure)
 * — `has()` asks the module, so every generator that filters through this set is gated at creation time.
 */
class NeverSet extends Set {
  has(w) { return super.has(w) || wordProblems(String(w)).length > 0; }
}
export function neverAnswer() {
  return new NeverSet([...wordset('offensive-blocklist.txt'), ...wordset('manual-blocklist.txt'),
    ...wordset('names-blocklist.txt'), ...wordset('proper-noun-blocklist.txt'), ...wordset('answer-proper-nouns.txt')]);
}
/** Substrings that must not appear anywhere a player can read letters in a row. */
export const BLOCKED_SUBSTRINGS = () => [...wordset('offensive-blocklist.txt')].filter((w) => w.length >= 3);
/** A run of letters a player can read (a scramble, a grid row) that spells something offensive, roots included. */
export const readsOffensive = (letters) => offensiveText(String(letters)) !== null || offensiveWord(String(letters)) !== null;
// The content gate, re-exported for the generators: gateBank(bankId, bank) right before a bank is written.
export { gateBank, wordRejects, textRejects } from '../../../../packages/core/src/content-safety/gate.mjs';
export { wordProblems, textProblems } from '../../../../packages/core/src/content-safety/safety.mjs';
export function writeSample(name, obj) {
  fs.mkdirSync(SAMPLES, { recursive: true });
  const p = path.join(SAMPLES, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 1));
  return p;
}
