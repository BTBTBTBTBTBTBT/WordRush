import { describe, expect, it } from 'vitest';
import { SQUISH_FRAMES, squishKind } from './squish';

// FINISH_SPEC A9: ~.92 on touch-down (icons .86/.80), spring back past 1 (~1.05), ≈260 ms.

describe('the spongy press', () => {
  it('uses the approved scales and timing', () => {
    expect(SQUISH_FRAMES.press.down).toBe('scale(0.92)');
    expect(SQUISH_FRAMES.press.over).toBe('scale(1.05)');
    expect(SQUISH_FRAMES.press.upMs).toBe(260);
    expect(SQUISH_FRAMES.icon.down).toBe('scale(0.86, 0.8)');
    expect(SQUISH_FRAMES.icon.upMs).toBe(260);
    for (const f of Object.values(SQUISH_FRAMES)) {
      expect(f.upMs).toBeGreaterThanOrEqual(200);
      expect(f.upMs).toBeLessThanOrEqual(300);
      expect(f.downMs).toBeLessThan(f.upMs);
    }
  });

  it('picks the press by element', () => {
    expect(squishKind('candy candy-purple')).toBe('candy');
    expect(squishKind('kkey w-10')).toBe('key');
    expect(squishKind('hdr-glyph squish')).toBe('icon');
    expect(squishKind('block tab-squish')).toBe('icon');
    expect(squishKind('relative flex rounded-xl')).toBe('press');
    expect(squishKind('')).toBe('press');
    expect(squishKind('candyfloss')).toBe('press');
  });
});
