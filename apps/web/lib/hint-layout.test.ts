import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { CLUE_SLOT_PX, KINDRED_LABEL_SLOT_PX, clueSlotHeight, hintCountText, hubTileSize } from './hint-layout';

// Founder 10-03: "Hitting the hint button caused one of the puzzle games to
// shrink a bit." A hint, check or reveal (or a toast / hint message) must never
// change a board's size or move the layout.

describe('hint count badge text', () => {
  it('is empty at zero (no badge) and caps at 99+', () => {
    expect(hintCountText(0)).toBe('');
    expect(hintCountText(-1)).toBe('');
    expect(hintCountText(Number.NaN)).toBe('');
    expect(hintCountText(1)).toBe('1');
    expect(hintCountText(12)).toBe('12');
    expect(hintCountText(99)).toBe('99');
    expect(hintCountText(100)).toBe('99+');
  });
});

describe('ProperNoundle clue slot', () => {
  it('is the same height with and without a clue (two 16 px lines + padding)', () => {
    expect(clueSlotHeight(null)).toBe(CLUE_SLOT_PX);
    expect(clueSlotHeight('')).toBe(CLUE_SLOT_PX);
    expect(clueSlotHeight('A short clue')).toBe(CLUE_SLOT_PX);
    expect(clueSlotHeight('A very long Wikipedia clue '.repeat(20))).toBe(CLUE_SLOT_PX);
    expect(CLUE_SLOT_PX).toBe(40);
  });
});

describe('Hubbub hexagon size', () => {
  // Rank bar, entry line, two control rows, found-words header, End.
  const fixed = [44, 49, 92, 16, 52];
  it('matches the board with and without pending "Starts with…" hints', () => {
    // The hint chips render inside the found-words flow, never as a fixed row,
    // so the measured fixed rows (and the tile) are identical either way.
    const idle = hubTileSize(520, 390, fixed);
    const hinted = hubTileSize(520, 390, fixed);
    expect(hinted).toBe(idle);
  });
  it('would shrink if a hint row joined the fixed rows (the bug)', () => {
    const before = hubTileSize(520, 390, fixed);
    const withHintRow = hubTileSize(520, 390, [...fixed.slice(0, 3), 24, ...fixed.slice(3)]);
    expect(withHintRow).toBeLessThan(before);
  });
  it('clamps to 72…100 and the width guard', () => {
    expect(hubTileSize(2000, 2000, fixed)).toBe(100);
    expect(hubTileSize(200, 390, fixed)).toBe(72);
    expect(hubTileSize(2000, 300, fixed)).toBe(83);
  });
});

describe('hint layout guard (source)', () => {
  const ROOT = join(__dirname, '..');
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });

  it('no button label grows with a hint/check count (it wrapped action rows and shrank boards)', () => {
    const LABEL_COUNT = /(?:hintsUsed|checks) > 0 \? ` · \$\{(?:state\.)?(?:hintsUsed|checks)\}` : ''/;
    const hits = walk(join(ROOT, 'components')).filter((f) => LABEL_COUNT.test(readFileSync(f, 'utf8'))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });

  it('Hubbub: no hint chips between the hint buttons and the found-words header', () => {
    const src = read('components/hub/hub-game.tsx');
    const fixedControls = src.slice(src.indexOf('ref={setFixed(2)}'), src.indexOf('ref={setFixed(3)}'));
    expect(fixedControls.length).toBeGreaterThan(0);
    expect(fixedControls).not.toMatch(/hinted|pendingHintChips/);
    expect(src).not.toContain('border-dashed');
    expect(src).toContain('{pendingHintChips}{wordChips(newestFound)}');
  });

  it('ProperNoundle (solo + VS): the clue lives in the always-present slot', () => {
    for (const f of ['components/propernoundle/propernoundle-game.tsx', 'components/vs/vs-propernoundle.tsx']) {
      expect(read(f)).toContain('<ClueSlot clue={hints.hint} />');
    }
    expect(read('components/vs/vs-propernoundle.tsx')).not.toContain('{hints.hint && (');
  });

  it('Kindred: the named-category chips sit in a fixed slot', () => {
    const src = read('components/groups/groups-game.tsx');
    expect(src).not.toContain('revealedLabels.length > 0 &&');
    expect(src).toContain('height: KINDRED_LABEL_SLOT_PX');
    expect(KINDRED_LABEL_SLOT_PX).toBeGreaterThan(0);
  });

  it('Codebreaker: the conflict warning is an overlay, not a line in the fitted band', () => {
    const src = read('components/cryptogram/cryptogram-game.tsx');
    const at = src.indexOf('conflicts.length > 0 && (');
    expect(at).toBeGreaterThan(0);
    expect(src.slice(at, at + 200)).toContain('absolute');
  });

  it('every in-game FeedbackToast sits in a position: relative anchor', () => {
    // FeedbackToast is absolute; each usage's nearest wrapper above it must be `relative`.
    const offenders: string[] = [];
    for (const f of walk(join(ROOT, 'components'))) {
      const src = readFileSync(f, 'utf8');
      let i = src.indexOf('<FeedbackToast ');
      while (i >= 0) {
        const before = src.slice(Math.max(0, i - 1600), i);
        const opens = [...before.matchAll(/<div\b[^>]*className=["{`][^>]*>/g)];
        if (!opens.some((m) => /\brelative\b/.test(m[0]))) offenders.push(relative(ROOT, f));
        i = src.indexOf('<FeedbackToast ', i + 1);
      }
    }
    expect(offenders).toEqual([]);
  });
});
