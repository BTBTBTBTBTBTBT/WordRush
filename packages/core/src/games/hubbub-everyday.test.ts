import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { HubBank } from './hub';

// FRIDAY-QUEUE item 33 (founder/Johnny/Doug reports): everyday words must be accepted by every Hubbub puzzle
// whose letters fit them — dailies from the content release date on (served days are frozen) + Unlimited.
const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const bank = JSON.parse(fs.readFileSync(join(repo, 'apps', 'web', 'data', 'hub-puzzles.json'), 'utf8')) as HubBank;
const RELEASE = '2026-10-13';
const epoch = Date.parse(`${bank.epoch}T00:00:00Z`);
const dayOf = (i: number) => new Date(epoch + i * 86400000).toISOString().slice(0, 10);
const live = [...bank.daily.filter((_, i) => dayOf(i) >= RELEASE), ...bank.extra];
const REPORTED = ['RECOLLECT', 'RECYCLER', 'REELECT', 'FUTON', 'AUNTY', 'AUNT'];
const fits = (w: string, letters: string) => w.includes(letters[0]) && [...w].every((ch) => letters.includes(ch));

describe('Hubbub accepts everyday words', () => {
  it('every reported word is accepted wherever its letters fit', () => {
    const missing: string[] = [];
    for (const w of REPORTED) for (const p of live) {
      if (fits(w, p.letters) && ![...p.words, ...p.bonus].includes(w)) missing.push(`${p.id} ${w}`);
    }
    expect(missing).toEqual([]);
  });
});
