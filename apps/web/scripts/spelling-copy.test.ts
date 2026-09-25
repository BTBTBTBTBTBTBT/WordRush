import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Wordocious is written in American English (founder, 2026-09-24: "everywhere
 * the word colour appears ... adjust to color as it should be spelled"). This
 * greps the web app's copy, components and the shared catalog for the British
 * spellings that have slipped in before, so a guide, playbook, How To Play
 * entry, mode description or puzzle caption cannot regress. Word LISTS are
 * deliberately not scanned: COLOUR is a legitimate accepted guess, and the
 * dictionary keeps an entry for it.
 */
const ROOT = join(__dirname, '..');
const DIRS = ['app', 'components', 'lib', 'data'].map((d) => join(ROOT, d));
const CATALOG = join(ROOT, '..', '..', 'packages', 'core', 'modes.json');
const SKIP = /^(allowed-\d|solutions-\d|word-definitions|.*lexicon.*)\.json$/; // word lists and the dictionary (its keys are words)
const PATTERN = /\bcolou(r|rs|red|ring|rful|rless|ration|rblind)\b/i;

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (name !== 'node_modules' && name !== '.next') yield* walk(p); }
    else if (/\.(tsx?|mjs|json)$/.test(name) && !/\.test\.tsx?$/.test(name) && !SKIP.test(name)) yield p;
  }
}

describe('American spelling in player-facing copy', () => {
  it('has no British "colour" anywhere in app copy, components, banks or the catalog', () => {
    const hits: string[] = [];
    for (const file of [...DIRS.flatMap((d) => [...walk(d)]), CATALOG]) {
      const text = readFileSync(file, 'utf8');
      // JSON banks: theme KEYS are internal ids and may keep any spelling; only quoted string VALUES count.
      const scan = file.endsWith('.json') ? text.replace(/"theme"\s*:\s*"[^"]*"/g, '"theme":""') : text;
      const lines = scan.split('\n');
      lines.forEach((line, i) => { if (PATTERN.test(line)) hits.push(`${relative(ROOT, file)}:${i + 1}`); });
    }
    expect(hits, `British spelling found:\n${hits.slice(0, 20).join('\n')}`).toEqual([]);
  });
});
