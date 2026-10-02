import { describe, expect, it } from 'vitest';
import { ART_SIZE } from '@/lib/art';
import { NOTICE_COLORS, NOTICE_POSES, noticePoses, sentNoticeKind, type VsNoticeKind } from './vs-notice-art';

describe('VS notice art (FINISH_SPEC K1 / A7)', () => {
  it('only uses pose art that ships', () => {
    for (const list of Object.values(NOTICE_POSES)) {
      for (const name of list) expect(ART_SIZE[name]).toBeDefined();
    }
  });

  it('never uses a bot ready / waiting image (those picture the bots on VS screens)', () => {
    for (const list of Object.values(NOTICE_POSES)) {
      for (const name of list) expect(name).not.toMatch(/-(ready|waiting)$/);
    }
  });

  it('walks through a kind\'s poses so a list never repeats an image', () => {
    const kinds: VsNoticeKind[] = ['challenge', 'challenge', 'beaten', 'challenge', 'beaten'];
    const poses = noticePoses(kinds);
    expect(poses).toEqual([
      NOTICE_POSES.challenge[0], NOTICE_POSES.challenge[1], NOTICE_POSES.beaten[0], NOTICE_POSES.challenge[2], NOTICE_POSES.beaten[1],
    ]);
    expect(new Set(poses).size).toBe(poses.length);
  });

  it('no image is shared between kinds', () => {
    const all = Object.values(NOTICE_POSES).flat();
    expect(new Set(all).size).toBe(all.length);
  });

  it('maps sent-challenge outcomes (sender side) to kinds', () => {
    expect(sentNoticeKind('loss')).toBe('beaten');
    expect(sentNoticeKind('win')).toBe('held');
    expect(sentNoticeKind('draw')).toBe('tied');
    expect(sentNoticeKind(undefined)).toBe('waiting');
    expect(Object.keys(NOTICE_COLORS).sort()).toEqual(Object.keys(NOTICE_POSES).sort());
  });
});
