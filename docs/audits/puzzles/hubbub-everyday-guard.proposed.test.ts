import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HubBank } from './hub';

// PROPOSED guard (Friday queue item 33): everyday words players reported as rejected must be
// accepted by every puzzle whose letters fit them. Lives in docs/audits/puzzles until the
// additions in hubbub-additions.json are applied; then move it to packages/core/src/games/.
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'hub-puzzles.json'), 'utf8')) as HubBank;
const all = [...bank.daily, ...bank.extra];

/** Reported everyday words and the puzzles whose letters fit them (center included). */
const KNOWN: ReadonlyArray<{ id: string; word: string }> = [
  { id: 'hb0016', word: 'RECOLLECT' },
  { id: 'hb0026', word: 'RECOLLECT' },
  { id: 'hb0059', word: 'RECOLLECT' },
  { id: 'hb0016', word: 'RECYCLER' },
  { id: 'hb0354', word: 'RECYCLER' },
  { id: 'hb0016', word: 'REELECT' },
  { id: 'hb0026', word: 'REELECT' },
  { id: 'hb0059', word: 'REELECT' },
  { id: 'hb0307', word: 'REELECT' },
  { id: 'hb0354', word: 'REELECT' },
  { id: 'hb0490', word: 'AUNTY' },
  { id: 'hb0017', word: 'FUTON' },
  { id: 'hb0163', word: 'FUTON' },
];

describe('Hubbub accepts everyday words', () => {
  it.each(KNOWN)('$id accepts $word', ({ id, word }) => {
    const p = all.find((x) => x.id === id);
    expect(p, id).toBeTruthy();
    expect([...p!.words, ...p!.bonus]).toContain(word);
  });

  it('every reported word is accepted wherever its letters fit', () => {
    const words = [...new Set(KNOWN.map((k) => k.word))];
    for (const w of words) for (const p of all) {
      const fits = [...w].every((c) => p.letters.includes(c)) && w.includes(p.letters[0]);
      if (fits) expect([...p.words, ...p.bonus], `${p.id} ${w}`).toContain(w);
    }
  });
});
