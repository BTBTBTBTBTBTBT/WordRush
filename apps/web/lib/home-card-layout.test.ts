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
  it('makes the text column exactly the icon tall: title line + two subtitle lines', () => {
    expect(MODE_CARD.titleLine).toBe(MODE_CARD.name * 1.25); // leading-tight
    expect(MODE_CARD.titleLine + 2 * MODE_CARD.descLine).toBe(MODE_CARD.icon);
  });

  it('puts the badge on the title line, not in the corner, and drops the chevron', () => {
    const card = src('components/home/mode-card.tsx');
    expect(card).toContain('<TitleLineSlot>{slot}</TitleLineSlot>');
    expect(card).toContain('flex flex-col justify-between');
    expect(card).not.toMatch(/absolute top-1 right-1\.5/);
    expect(card).not.toContain('ChevronRight');
  });

  it('frames Word of the Day and VS Battle with the game card surface and band (§21.5)', () => {
    for (const file of ['components/home/word-of-the-day.tsx', 'components/home/vs-live-tile.tsx']) {
      const s = src(file);
      expect(s, file).toContain('modeCardSurface(');
      expect(s, file).toContain('<ModeCardBand accent=');
      expect(s, file).toContain('MODE_CARD.padY');
    }
    expect(src('components/home/word-of-the-day.tsx')).toContain("'#4CC77A'");
    // The VS badge sits on its title line too.
    expect(src('components/home/vs-live-tile.tsx')).toContain('<TitleLineSlot line={16}>');
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
