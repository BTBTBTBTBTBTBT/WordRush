import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { contrastRatio, over, parseColor, type RGBA } from '@wordle-duel/core';
import { SEASON_REGISTRY } from './season-kit';

// 2.8 wave 5 (item 49 part 2): the wave-3 surfaces (Friends cards, the VS lobby, the pocket-game wait strip, the help
// / tutorial cards, the Hubbub controls) read in a dark season. They use the same CSS variables as the older Friends
// and VS pages (globals.css `html[data-season-tone="dark"]`); this pins the pairs they put on the night glass at WCAG AA.
// Ports: iOS SeasonContrastTests, Android SeasonContrastTest.

const css = readFileSync(path.resolve(__dirname, '../app/globals.css'), 'utf8');
const rgba = (hex: string, a = 1): RGBA => { const c = parseColor(hex)!; return [c[0], c[1], c[2], a]; };

/** A custom property's value inside the first `html[data-season-tone="dark"]` rule that defines it. */
function darkVar(name: string): string {
  const blocks = css.split('html[data-season-tone="dark"]').slice(1);
  for (const b of blocks) {
    const m = b.slice(0, b.indexOf('\n}')).match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`));
    if (m) return m[1];
  }
  throw new Error(`${name} has no dark-season value`);
}

const AA = 4.5;

describe('dark-season surfaces of the wave-3 screens', () => {
  const dark = SEASON_REGISTRY.filter((s) => s.surfaces?.tone === 'dark');
  it('there is a dark season to check', () => expect(dark.length).toBeGreaterThan(0));

  for (const s of dark) {
    const sf = s.surfaces!;
    const card = over(rgba(sf.card!, sf.cardOpacity ?? 1), rgba(s.palette.wallDark[1]));
    describe(s.id, () => {
      it('the friend card: its name, line and "playing" text read on the card', () => {
        for (const ink of [sf.text!, sf.textSecondary!, sf.textMuted!, darkVar('--fr-online')]) {
          expect(contrastRatio(rgba(ink), card), `${ink} on the card`).toBeGreaterThanOrEqual(AA);
        }
      });
      it('the waiting-room status chip reads (--vs-deep on --vs-soft)', () => {
        expect(contrastRatio(rgba(darkVar('--vs-deep')), rgba(darkVar('--vs-soft')))).toBeGreaterThanOrEqual(AA);
      });
      it('the Friends inks the cards and the pocket screens use read on the card', () => {
        for (const v of ['--fr-banner-ink', '--fr-banner-clock', '--fr-gold-ink', '--fr-play-label', '--fr-flame', '--fr-teal']) {
          expect(contrastRatio(rgba(darkVar(v)), card), v).toBeGreaterThanOrEqual(AA);
        }
      });
    });
  }
});
