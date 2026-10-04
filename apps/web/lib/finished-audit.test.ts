import { describe, expect, it } from 'vitest';
import { ART_SIZE } from './art';
import { AUDIT_PHONES, finishedBoardRoom, singleBoardTile } from './finished-layout';
import { bestRecapLayout, recapCandidates } from './recap-fit';

// One-screen audit (founder 10-02): every completed game opened from Home fits
// one screen on 390×844 and 375×667. Tile floors per game; OctoWord on the SE
// was the known compromise (7 px) until BA1 (founder 10-02): title art ≤ 56
// and the Unlimited card as a chip under 700 tall.

const ratio = (name: keyof typeof ART_SIZE) => ART_SIZE[name][1] / ART_SIZE[name][0];
const [BIG, SE] = AUDIT_PHONES;

const single = [
  { game: 'Classic', art: 'art-game-practice', cols: 5, rows: 6 },
  { game: 'Classic Six', art: 'art-game-six', cols: 6, rows: 7 },
  { game: 'Classic Seven', art: 'art-game-seven', cols: 7, rows: 8 },
] as const;
const multi = [
  { game: 'QuadWord', art: 'art-game-quordle', boards: 4, rows: 9, cap: 26 },
  // OctoWord gives the strip headline and the tall Unlimited card's room to its boards.
  { game: 'OctoWord', art: 'art-game-octordle', boards: 8, rows: 13, cap: 18, lean: true },
  { game: 'Succession', art: 'art-game-sequence', boards: 4, rows: 10, cap: 26 },
  { game: 'Deliverance', art: 'art-game-rescue', boards: 4, rows: 6, cap: 26 },
] as const;

export function auditRows() {
  const out: Array<{ game: string; phone: string; room: string; tile: number }> = [];
  for (const phone of AUDIT_PHONES) {
    for (const g of single) {
      const room = finishedBoardRoom(phone, { artRatio: ratio(g.art) });
      out.push({ game: g.game, phone: phone.name, room: `${room.width}x${room.height}`, tile: singleBoardTile(room, g.cols, g.rows) });
    }
    for (const g of multi) {
      const lean = 'lean' in g && g.lean;
      const room = finishedBoardRoom(phone, { artRatio: ratio(g.art), headline: !lean, compactUnlimited: lean });
      const fit = bestRecapLayout({ ...room, boards: g.boards, wordLength: 5, rows: g.rows, maxTile: g.cap }, recapCandidates(g.boards));
      out.push({ game: g.game, phone: phone.name, room: `${room.width}x${room.height}`, tile: fit.tile });
    }
  }
  return out;
}

describe('one-screen finished audit', () => {
  it('BA1: the SE board room grows from the measured 237 to ~275 (title art 56, Unlimited as a 38 px chip line)', () => {
    const room = finishedBoardRoom(SE, { artRatio: ratio('art-game-quordle') });
    expect(room.width).toBe(351);
    expect(room.height).toBeGreaterThanOrEqual(237 + 30);
  });

  it('every single-board game keeps readable tiles on both phones', () => {
    for (const r of auditRows().filter((r) => single.some((g) => g.game === r.game))) {
      expect(r.tile, `${r.game} @ ${r.phone}`).toBeGreaterThanOrEqual(22);
    }
  });

  // With the chip on its own line (Android parity) the SE lands at QuadWord 14 / OctoWord 8 —
  // the in-row chip would give the spec's 15 / 10. Flagged for the founder.
  it('BA1: QuadWord 14 px and OctoWord 8 px on the SE (was 14 / 7); OctoWord 11 px on 390×844', () => {
    const at = (game: string, phone: string) => auditRows().find((r) => r.game === game && r.phone === phone)!.tile;
    expect(at('QuadWord', SE.name)).toBeGreaterThanOrEqual(14);
    expect(at('OctoWord', SE.name)).toBeGreaterThanOrEqual(8);
    expect(at('OctoWord', BIG.name)).toBeGreaterThanOrEqual(11);
  });

  it('multi-board recaps: ≥ 11 px tiles on 390×844, ≥ 8 px on the SE', () => {
    for (const r of auditRows().filter((r) => multi.some((g) => g.game === r.game))) {
      expect(r.tile, `${r.game} @ ${r.phone}`).toBeGreaterThanOrEqual(r.phone === SE.name ? 8 : 11);
    }
  });

  // Founder 10-02 follow-up ("we can't give up board room"): the share CTA lives IN the dock's
  // one 40 px action row and the countdown rides inside it — no row of its own, dropped under 700 tall.
  it('10-02: Share results sits in the action row, ≤ 40 px, the countdown inside it (hidden under 700 tall)', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'components', 'game', 'finished-kit.tsx'), 'utf8');
    const share = src.slice(src.indexOf('export function ShareResultsCandy'), src.indexOf('// ── R2: the action dock'));
    // The md candy (40 px, globals.css .candy-md) with the countdown as its second line, gone on compact heights.
    expect(share).toContain('size="md"');
    expect(share).toMatch(/text-\[11px\][^\n]*\[@media\(max-height:699\.98px\)\]:hidden/);
    expect(share).toContain('Next </span>');
    // No separate countdown row, no share row: the dock renders the candy inside its one action row.
    const dock = src.slice(src.indexOf('export function FinishedDock'));
    expect(dock).not.toContain('NextDailyCountdown');
    const row = dock.slice(dock.indexOf('{(share || primary) && ('), dock.indexOf('{/* BA1: under 700 px tall'));
    expect(row).toContain('{share}');
    expect(row).toContain('{primary}');
    const css = fs.readFileSync(require('path').join(__dirname, '..', 'app', 'globals.css'), 'utf8');
    expect(css).toContain('.candy-md { --candy-h: 40px;');
  });

  it('BA1 shows the Unlimited chip on its own line, only under 700 tall, with the PRO pill for free players', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'components', 'game', 'finished-kit.tsx'), 'utf8');
    expect(src).toContain('hidden [@media(max-height:699.98px)]:flex justify-center');
    expect(src).toMatch(/trailing=\{<ProPill \/>\}[^\n]*Unlimited \$\{mode.title\} with Pro/);
    expect(src).toContain("[@media(max-height:699.98px)]:!hidden");
  });
});

describe('BA2 Gauntlet results fit one screen', () => {
  it('keeps hero + stars + stat pills + buttons on screen; the score and stage breakdowns sit behind More', async () => {
    const fs = await import('fs');
    const src = fs.readFileSync(require('path').join(__dirname, '..', 'components', 'gauntlet', 'gauntlet-results.tsx'), 'utf8');
    const board = src.slice(src.indexOf('board={'), src.indexOf('dock={'));
    const more = src.slice(src.indexOf('more={'));
    expect(board).toContain('starRow(');
    expect(board).toContain('StatLabel');
    expect(board).not.toContain('ScoreBreakdownCard');
    expect(board).not.toContain('Stage Breakdown');
    expect(more).toContain('<ScoreBreakdownCard');
    expect(more).toContain('Stage Breakdown');
    // The hero scene shrinks to the room (flex 0 1 auto, min-h-0) instead of pushing the dock off screen.
    expect(board).toContain("flex: '0 1 auto'");
  });
});
