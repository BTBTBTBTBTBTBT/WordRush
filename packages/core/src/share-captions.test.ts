import { describe, expect, it } from 'vitest';
import { SHARE_CAPTIONS, SHARE_TOASTS, captionHash, shareCaption, shareCaptionIndex } from './share-captions';

describe('share captions (FINISH_SPEC S4)', () => {
  it('hashes with FNV-1a 32-bit', () => {
    expect(captionHash('')).toBe(2166136261);
    expect(captionHash('a')).toBe(0xe40c292c);
    expect(captionHash('foobar')).toBe(0xbf9cf968);
  });
  it('picks deterministically by date + game', () => {
    const a = shareCaptionIndex('win', '2026-10-02', 'QuadWord');
    expect(shareCaptionIndex('win', '2026-10-02', 'QuadWord')).toBe(a);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(SHARE_CAPTIONS.win.length);
    const days = Array.from({ length: 30 }, (_, i) => `2026-10-${String(i + 1).padStart(2, '0')}`);
    expect(new Set(days.map((d) => shareCaptionIndex('win', d, 'Classic'))).size).toBe(3);
  });
  it('fills the placeholders and appends the streak at 3+', () => {
    expect(shareCaption('multiWin', { date: '2026-10-02', game: 'QuadWord', b: 4, n: 9 })).toBe('All 4 QuadWord boards cleared in 9 guesses 🧠✨');
    expect(shareCaption('flawless', { date: '2026-10-02', game: 'Classic', d: 5 })).toBe('Flawless Classic! 💎 Not one wasted guess. 🔥 Day 5');
    expect(shareCaption('flawless', { date: '2026-10-02', game: 'Classic', d: 2 })).toBe('Flawless Classic! 💎 Not one wasted guess.');
    expect(shareCaption('vsInvite', { date: '2026-10-02', game: 'Classic', url: 'https://wordocious.com/vs/join/AB12', d: 9 })).toBe('Race me at Classic! ⚡ https://wordocious.com/vs/join/AB12');
    expect(shareCaption('vsDraw', { date: '2026-10-02', game: 'Classic', opp: 'Doug' })).toBe('Doug and I tied at Classic. Rematch? ⚔️');
    expect(shareCaption('gauntletLose', { date: '2026-10-02', game: 'Gauntlet', k: 3 })).toBe('Reached stage 3 of the Gauntlet. Can you go further?');
  });
  it('is short, kind and free of em dashes', () => {
    for (const line of [...Object.values(SHARE_CAPTIONS).flat(), ...Object.values(SHARE_TOASTS)]) {
      expect(line).not.toMatch(/—/);
      expect(line.length).toBeLessThan(80);
    }
  });
});
