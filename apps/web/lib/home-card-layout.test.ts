import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MODE_CARD } from '@/components/home/mode-card';

// Source guards for docs/ART_SPEC.md §21 (Home game card): the badge on the
// title line, the text column spanning the icon, no ">" chevrons on menu
// cards / rows, and the Word of the Day + VS Battle cards in the game-card frame.

const root = path.join(__dirname, '..');
const src = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('Home game card (§21)', () => {
  it('is the compact card (FINISH_SPEC BH2): 74 tall, 42 icon, 17 name, ONE 13 subtitle line', () => {
    expect(MODE_CARD.height).toBeGreaterThanOrEqual(72);
    expect(MODE_CARD.height).toBeLessThanOrEqual(76);
    expect(MODE_CARD.icon).toBeGreaterThanOrEqual(40);
    expect(MODE_CARD.icon).toBeLessThanOrEqual(44);
    expect(MODE_CARD.name).toBe(17);
    expect(MODE_CARD.desc).toBe(13);
    // The name line + one subtitle line fit beside the icon, under the trim.
    expect(MODE_CARD.titleLine + MODE_CARD.descLine).toBeLessThanOrEqual(MODE_CARD.icon);
    expect(MODE_CARD.band + MODE_CARD.icon + 2 * 8).toBeLessThanOrEqual(MODE_CARD.height);
  });

  it('pins the badge to the icon, keeps the name on one line, no stroke and no chevron (BH)', () => {
    const card = src('components/home/mode-card.tsx');
    expect(card).toContain('slots.iconBadge');
    expect(card).toContain('whitespace-nowrap');
    expect(card).toContain('truncate');
    expect(card).not.toMatch(/WebkitLineClamp|overflowWrap = 'anywhere'/);
    expect(card).not.toMatch(/border:\s*`/);
    expect(card).not.toContain('ChevronRight');
  });

  it('draws the trim as ONE static path (BH1/BH4)', () => {
    const card = src('components/home/mode-card.tsx');
    const band = card.slice(card.indexOf('export function ModeCardBand'), card.indexOf('const TRIM_PATH'));
    expect(band.match(/<path /g)).toHaveLength(1);
    expect(band).not.toMatch(/filter|blur|animate|transition|boxShadow/);
  });

  it('shrinks the DAILIES / PUZZLES titles ~25% (BH2)', () => {
    const page = src('app/page.tsx');
    expect(page).toContain('label="Dailies" compact');
    expect(page).toContain('label="Puzzles" compact');
    expect(page).toContain('home-cards grid grid-cols-2 gap-2.5');
  });

  it('frames VS Battle with the game card surface and band (§21.5)', () => {
    for (const file of ['components/home/vs-live-tile.tsx']) {
      const s = src(file);
      expect(s, file).toContain('modeCardSurface(');
      expect(s, file).toContain('<ModeCardBand accent=');
      expect(s, file).toContain('MODE_CARD.padY');
    }
    // The VS badge sits on its title line too.
    expect(src('components/home/vs-live-tile.tsx')).toContain('<TitleLineSlot line={16}>');
  });

  it('gives Word of the Day the guide hero card look, no stroke (FINISH_SPEC BI17)', () => {
    const s = src('components/home/word-of-the-day.tsx');
    expect(s).toContain("'#4CC77A'");
    expect(s).toContain('guideCardStyle(WOTD_ACCENT');
    expect(s).toContain('GUIDE_BAR');
    expect(s).toContain('<GuideStage host="i"');
    expect(s).not.toMatch(/border:|\bborder-|\bring-|outline|lucide-react/);
  });

  it('rebalances the Home banner card (FINISH_SPEC BI21)', () => {
    const s = src('components/home/home-banner.tsx');
    // Centered headline with the host clearance mirrored on both sides.
    expect(s).toContain('paddingLeft: tierArt || seasonArt ? slots.shareWidth + 6 : HEADLINE_SIDE_CLEAR');
    expect(s).toContain('justify-center text-center');
    // Centered wide switch, equal halves, the PRO chip inside the Unlimited half.
    expect(s).toContain("width: '76%', maxWidth: 280");
    expect(s).toContain("flex: '1 1 0'");
    expect(s).not.toMatch(/translateX\(\$\{switchBox/);
    // Centered meta line with tabular digits.
    expect(s).toContain("fontVariantNumeric: 'tabular-nums'");
    // Rows spread edge to edge at one tile size; no outlined / dashed tiles.
    expect(s).toContain('flex justify-between w-full');
    expect(s).toContain('const TILE_SIZE =');
    expect(s).not.toMatch(/softIconTile|dashed|strokeDasharray/);
  });

  it('has no ">" disclosure chevrons on menu cards or rows (§21.4)', () => {
    for (const file of [
      'components/modals/menu-modal.tsx',
      'components/share/share-variant-modal.tsx',
      'components/profile/profile-social.tsx',
      'components/gauntlet/gauntlet-results.tsx',
      'components/friends/friends-banner.tsx',
      'app/guides/page.tsx',
      'app/strategy/page.tsx',
    ]) {
      expect(src(file), file).not.toContain('ChevronRight');
    }
    for (const file of ['components/settings-dialog.tsx', 'components/settings/linked-sign-ins.tsx', 'app/profile/[id]/page.tsx']) {
      expect(src(file), file).not.toMatch(/>\s*›\s*</);
    }
  });
});
