#!/usr/bin/env node
// More Games puzzle banks, served one puzzle per file (founder, 2026-09-29).
//
// data/<game>-puzzles.json stays the single source of truth (the natives, the
// core parity tests and the runway report all read it). This writes
//   public/banks/<game>/<hash>/d<i>.json   daily[i]
//   public/banks/<game>/<hash>/x<i>.json   extra[i]
//   public/banks/<game>/<hash>/h-<key>-<i>.json   holiday[key][i]
// where <hash> is the bank file's content hash (so every URL is immutable),
// plus lib/banks-manifest.json — per game the hash, epoch and section sizes.
// The client (lib/bank-loader.ts) runs the core's own puzzleForDay/ForSeed on
// a stub bank of that shape and fetches only the one entry it picks, so the
// daily-selection rules are the core's, byte for byte.
//
// Runs on every `next dev` / `next build` (required from next.config.js) and
// by hand: `node scripts/split-banks.js`. public/banks is generated
// (gitignored); the manifest is checked in and guarded by bank-loader.test.ts.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const GAMES = ['hub', 'crossword', 'wordsearch', 'scramble', 'groups', 'cryptogram', 'ladder'];
const ROOT = path.resolve(__dirname, '..');
const KEY_RE = /^[a-z0-9_]+$/i;

function bankManifest(game) {
  const raw = fs.readFileSync(path.join(ROOT, 'data', `${game}-puzzles.json`));
  const bank = JSON.parse(raw);
  const h = crypto.createHash('sha256').update(raw).digest('hex').slice(0, 10);
  const m = { h, version: bank.version, epoch: bank.epoch, daily: bank.daily.length, extra: bank.extra.length };
  if (bank.holiday) {
    m.holiday = {};
    for (const [k, list] of Object.entries(bank.holiday)) {
      if (!KEY_RE.test(k)) throw new Error(`split-banks: unsafe holiday key "${k}" in ${game}`);
      m.holiday[k] = list.length;
    }
  }
  return { bank, m };
}

/** The manifest the checked-in lib/banks-manifest.json must equal (no files written). */
function computeManifest() {
  return Object.fromEntries(GAMES.map((g) => [g, bankManifest(g).m]));
}

function writeBank(game, bank, h) {
  const gameDir = path.join(ROOT, 'public', 'banks', game);
  const dir = path.join(gameDir, h);
  if (!fs.existsSync(path.join(dir, '.done'))) {
    const tmp = `${dir}.tmp-${process.pid}`;
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    const put = (name, v) => fs.writeFileSync(path.join(tmp, `${name}.json`), JSON.stringify(v));
    bank.daily.forEach((p, i) => put(`d${i}`, p));
    bank.extra.forEach((p, i) => put(`x${i}`, p));
    for (const [k, list] of Object.entries(bank.holiday ?? {})) list.forEach((p, i) => put(`h-${k}-${i}`, p));
    fs.writeFileSync(path.join(tmp, '.done'), '');
    try { fs.rmSync(dir, { recursive: true, force: true }); fs.renameSync(tmp, dir); }
    catch { fs.rmSync(tmp, { recursive: true, force: true }); }   // a parallel run got there first
  }
  // Only the current hash is served; stale ones would just sit in the deploy.
  for (const d of fs.readdirSync(gameDir)) if (d !== h && !d.includes('.tmp-')) fs.rmSync(path.join(gameDir, d), { recursive: true, force: true });
}

function splitBanks() {
  const manifest = {};
  for (const g of GAMES) {
    const { bank, m } = bankManifest(g);
    writeBank(g, bank, m.h);
    manifest[g] = m;
  }
  const file = path.join(ROOT, 'lib', 'banks-manifest.json');
  const text = `${JSON.stringify(manifest, null, 2)}\n`;
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);
  return manifest;
}

module.exports = { splitBanks, computeManifest, GAMES };

if (require.main === module) {
  const m = splitBanks();
  for (const [g, v] of Object.entries(m)) console.log(`split-banks: ${g} ${v.h} daily ${v.daily} extra ${v.extra}${v.holiday ? ` holiday ${Object.keys(v.holiday).length}` : ''}`);
}
