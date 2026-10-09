import { describe, expect, it } from 'vitest';
import {
  AVATAR_CODE_POSES, AVATAR_REACTION_HOPS, AVATAR_REACTION_POSE, AVATAR_REACTION_SECONDS,
  avatarLiveFrame, avatarPlacePose, avatarPoseDef, avatarPoseWithheld, AVATAR_POSES, type AvatarReaction,
} from './avatar-pose';

// 2.8 item 13: the extra reactions (sweep / flawless / progress) and the podium's place poses.

const frame = (kind: AvatarReaction, t: number, still = false) => avatarLiveFrame({ pose: 'none', t: 4, reaction: { kind, t }, still, ambient: false });

describe('sweep / flawless / progress reactions', () => {
  it('cheer for sweep and flawless, a short wave for progress', () => {
    expect(AVATAR_REACTION_POSE.sweep).toBe('cheer');
    expect(AVATAR_REACTION_POSE.flawless).toBe('cheer');
    expect(AVATAR_REACTION_POSE.progress).toBe('wave');
    // mid-reaction the arms are up (cheer = 135 outward)
    expect(frame('sweep', 1).spec.arms?.L?.rot).toBeGreaterThan(100);
    expect(frame('flawless', 1).spec.arms?.R?.rot).toBeGreaterThan(100);
  });

  it('the bigger the moment, the longer and higher it plays', () => {
    const s = AVATAR_REACTION_SECONDS;
    expect(s.flawless).toBeGreaterThan(s.sweep);
    expect(s.sweep).toBeGreaterThan(s.win);
    expect(s.progress).toBeLessThan(s.win);
    const h = AVATAR_REACTION_HOPS;
    expect(h.flawless!.n).toBeGreaterThan(h.sweep!.n);
    expect(h.sweep!.n).toBeGreaterThan(h.win!.n);
    expect(h.flawless!.amp).toBeGreaterThan(h.sweep!.amp);
  });

  it('hops (the body lifts) during a flawless, and returns to rest after it', () => {
    const lifts = [0.35, 0.65, 0.9, 1.2, 1.5, 1.75].map((t) => frame('flawless', t).spec.body!.dy!);
    expect(Math.min(...lifts)).toBeLessThan(-0.05);
    const after = frame('flawless', AVATAR_REACTION_SECONDS.flawless + 0.1);
    expect(after.spec.body!.dy).toBe(0);
    expect(after.spec.arms!.L!.rot).toBe(0);
  });

  it('Reduce Motion (still) never plays a reaction', () => {
    for (const k of ['sweep', 'flawless', 'progress'] as AvatarReaction[]) {
      expect(frame(k, 1, true).spec.body!.dy).toBe(0);
      expect(frame(k, 1, true).spec.arms!.L!.rot).toBe(0);
    }
  });
});

describe('podium place poses', () => {
  it('1st cheers, 2nd claps, 3rd waves, the rest stand as drawn', () => {
    expect([1, 2, 3, 4, 10].map(avatarPlacePose)).toEqual(['cheer', 'clap', 'wave', 'none', 'none']);
  });

  it('clap is a code pose (never in the Pose tab) with the hug fit\'s withheld list', () => {
    expect(AVATAR_POSES).not.toContain('clap');
    expect(avatarPoseDef('clap')).toBe(AVATAR_CODE_POSES.clap);
    expect(avatarPoseWithheld('clap', 'classic')).toEqual(avatarPoseWithheld('hug', 'classic'));
  });

  it('the clap swings both arms together', () => {
    const a = avatarLiveFrame({ pose: 'clap', t: 0.09 }).spec.arms!;
    const b = avatarLiveFrame({ pose: 'clap', t: 0.27 }).spec.arms!;
    expect(a.L!.rot).toBe(a.R!.rot);
    expect(a.L!.rot).not.toBe(b.L!.rot);
    // arms are brought in (negative = inward) at rest
    expect(avatarLiveFrame({ pose: 'clap', t: 0, ambient: false }).spec.arms!.L!.rot).toBeLessThan(-40);
  });
});
