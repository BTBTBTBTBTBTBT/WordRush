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
  it('is the compact card (FINISH_SPEC BH2): ~68 tall, 40 icon, 17 name, ONE 13 subtitle line', () => {
    expect(MODE_CARD.height).toBeGreaterThanOrEqual(64);
    expect(MODE_CARD.height).toBeLessThanOrEqual(70);
    expect(MODE_CARD.icon).toBe(40);
    expect(MODE_CARD.name).toBe(17);
    expect(MODE_CARD.desc).toBe(13);
    // The card hugs the top row: trim band + top pad + max(icon, name + 4 + one line) + bottom pad.
    const content = Math.max(MODE_CARD.icon, MODE_CARD.titleLine + MODE_CARD.descGap + MODE_CARD.descLine);
    expect(MODE_CARD.band + MODE_CARD.padTop + content + MODE_CARD.padY).toBeLessThanOrEqual(MODE_CARD.height + 1);
  });

  it('top-aligns icon, name and badge on one row; subtitle right under the name; no stroke, no chevron (BH)', () => {
    const card = src('components/home/mode-card.tsx');
    expect(card).toContain('flex items-start gap-2');
    expect(card).toContain('slots.titleSlotWidth');
    expect(card).toContain('marginTop: MODE_CARD.descGap');
    expect(card).toContain('whitespace-nowrap');
    expect(card).toContain('truncate');
    expect(card).toContain('compactCardLine(');
    expect(card).not.toMatch(/WebkitLineClamp|overflowWrap = 'anywhere'|justify-between/);
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
    // BJ6 symmetric hero (founder 10-03): the host centered on the card's top edge, the headline /
    // switch / meta line centered under it; no side column, no asymmetric room, no share on the card.
    expect(s).toContain('<HomeHost');
    expect(s).toContain('left: `calc(50% - ${BANNER_SLOT.hostSize / 2}px)`');
    expect(s).toContain('top: slots.headroom - BANNER_SLOT.hostRise');
    expect(s).not.toMatch(/HEADLINE_SIDE_CLEAR|paddingLeft:/);
    expect(s).not.toContain("aria-label=\"Share today's progress\"");
    expect(src('components/ui/app-header.tsx')).toContain('label="Share today\'s progress"');
    // BJ6 round 4: each laid-out headline line is centered (lib/home-headline.ts homeHeadlineLayout).
    expect(s).toContain('homeHeadlineLayout(slotWidth');
    expect(s).toContain('className="flex items-center justify-center" style={{ height: headLayout.lineHeight }}');
    // The centered switch fills its (narrower) column up to 260, equal halves, the PRO crown inside the Unlimited half.
    expect(s).toContain("width: '100%', maxWidth: 260");
    expect(s).toContain("flex: '1 1 0'");
    expect(s).not.toMatch(/translateX\(\$\{switchBox/);
    // Centered meta line with tabular digits.
    expect(s).toContain("fontVariantNumeric: 'tabular-nums'");
    // Rows spread edge to edge at one tile size; no outlined / dashed tiles.
    expect(s).toContain('flex justify-between w-full');
    expect(s).toContain('const TILE_SIZE =');
    expect(s).not.toMatch(/softIconTile|dashed|strokeDasharray/);
  });

  it('compresses the Home banner ~25% (FINISH_SPEC BH3): one-line headline, slim switch, tight rows', async () => {
    const { BANNER_SLOT, homeBannerSlots } = await import('./stationary-layout');
    const s = src('components/home/home-banner.tsx');
    expect(s).toContain('<FitOneLine');
    // BJ6 round 3: the headline is the big one-line brand lettering again (38 line).
    expect(BANNER_SLOT.headline).toBeLessThanOrEqual(38);
    expect(BANNER_SLOT.rowGap).toBe(4);
    expect(BANNER_SLOT.wordPadBottom + BANNER_SLOT.puzzlePadTop).toBe(8);
    // At a phone's ~29 px tiles: was 273 (headroom 16 + strip 127 + rows 130); BH3 208 (−24%).
    // BJ6 symmetric hero (founder 10-03): the 72 px host rises 28 above the card (headroom 6 → 22,
    // the other 6 over the header's bottom edge) and reaches 44 into it (strip top 4 → 44;
    // headline 28, gaps 6 / 3) — measured 255.
    // BJ6 round 3 (founder 10-03: "more prominent … more compact"): an 88 host (60 in the card),
    // the 8 brand cap, the 38 headline, and bigger progress tiles (~31 on a 390 phone: rows 8
    // from the sides, 4 gaps) — measured 289 at 31 px tiles (285 at the old 29).
    const h = homeBannerSlots('daily', { dailyTier: 'none', puzzleTier: 'none', playedAny: true }).height;
    expect(h - 2 * (BANNER_SLOT.tileLg - 31)).toBeLessThanOrEqual(289);
    expect(BANNER_SLOT.rowPadX).toBe(8);
    expect(BANNER_SLOT.tileGapMin).toBe(4);
    expect(src('components/ui/mascot.tsx')).toContain('export const BANNER_HOST_SIZE = 52');
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
