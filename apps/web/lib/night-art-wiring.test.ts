import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ACHIEVEMENTS } from './achievement-service';
import { ART_SIZE } from './art';

// Night art 10-03 "wire-ups that are code, not art" (docs/design/brand/NIGHT-ART-2026-10-03.md).

const read = (f: string) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

describe('night art 10-03 wiring', () => {
  it('the grid shows each achievement own art-ach-<key> (BD/BE lists all shipped), else its icon badge', () => {
    const listed = ['achievements.txt', 'achievements-new.txt'].flatMap((f) =>
      fs.readFileSync(path.join(__dirname, '../../../docs/design/brand/badges', f), 'utf8')
        .split('\n').map((l) => l.split('|')[0].trim()).filter((k) => /^[a-z0-9_]+$/.test(k)));
    const live = new Set(ACHIEVEMENTS.map((a) => a.key));
    const missing = listed.filter((k) => live.has(k) && !(`art-ach-${k}` in ART_SIZE));
    expect(missing).toEqual([]);
    expect(read('components/badges/achievement-grid.tsx')).toContain('<AchievementArt');
  });

  it('the MENU sheet shows the MENU title art (iOS parity)', () => {
    const s = read('components/modals/menu-modal.tsx');
    expect(s).toContain('name="art-title-menu"');
    expect(s).not.toContain('<LiveHeadline');
  });

  it('avatars wear the tier frame art over the code band', () => {
    const s = read('components/avatar/mascot-avatar.tsx');
    expect(s).toContain('frameArtName(worn)');
    expect(s).toContain('<FrameArt name={frameArt}');
    expect(read('lib/avatar-render.ts')).toContain("metal && !input.frameArt");
  });

  it('the gold clock sprite leads the reset countdowns', () => {
    // BJ6: the desktop Today card no longer repeats the reset countdown (one of each thing on Home).
    for (const f of ['components/modals/vs-limit-modal.tsx']) {
      expect(read(f), f).toContain("badgeSrc('icon-clock-sprite')");
    }
  });
});
