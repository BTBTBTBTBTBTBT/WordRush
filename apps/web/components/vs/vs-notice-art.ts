// The VS in-app notices' art + colors (docs/FINISH_SPEC.md K1): each event
// gets a small cast pose that fits it and a color for its tinted card. A7: on
// one screen a character never appears in the same image twice, so a list of
// notices of one kind walks through that kind's poses instead of repeating
// the first. The VS screens already show the S host, the Play tiles' poses and
// the bots' `ready` / `waiting` images, so none of those appear here. Pure.

import type { PoseArtName } from '@/lib/art';

export type VsNoticeKind =
  /** A friend challenged you (incoming, race their run). */
  | 'challenge'
  /** Someone beat your run. */
  | 'beaten'
  /** Your run held (they lost). */
  | 'held'
  /** A dead heat. */
  | 'tied'
  /** Nobody has raced it yet. */
  | 'waiting';

/** The poses per event, best fit first. */
export const NOTICE_POSES: Record<VsNoticeKind, readonly PoseArtName[]> = {
  challenge: ['art-pose-w-point', 'art-pose-o3-sneak', 'art-pose-c-map'],
  beaten: ['art-pose-o2-gasp', 'art-pose-d-skeptic', 'art-pose-r-wake'],
  held: ['art-pose-o1-cheer', 'art-pose-w-cheer', 'art-pose-i-cheer'],
  tied: ['art-pose-u-stretch', 'art-pose-c-lean', 'art-pose-d-lean'],
  waiting: ['art-pose-r-cocoa', 'art-pose-u-tea', 'art-pose-i-water'],
};

/** The tinted card's color per event (A1 wash + top bar). */
export const NOTICE_COLORS: Record<VsNoticeKind, string> = {
  challenge: '#0d9488',
  beaten: '#ec4899',
  held: '#7c3aed',
  tied: '#8b5cf6',
  waiting: '#64748b',
};

/**
 * The pose for each notice in a list, in order: the k-th notice of a kind
 * gets that kind's k-th pose (wrapping only past the list's length), so one
 * screen never repeats an image while the lists last.
 */
export function noticePoses(kinds: readonly VsNoticeKind[]): PoseArtName[] {
  const seen: Partial<Record<VsNoticeKind, number>> = {};
  return kinds.map((k) => {
    const n = seen[k] ?? 0;
    seen[k] = n + 1;
    const list = NOTICE_POSES[k];
    return list[n % list.length];
  });
}

/** The notice kind of a sent challenge's first result (core outcomes are from the sender's side). */
export function sentNoticeKind(outcome: 'win' | 'loss' | 'draw' | null | undefined): VsNoticeKind {
  if (outcome === 'loss') return 'beaten';
  if (outcome === 'win') return 'held';
  if (outcome === 'draw') return 'tied';
  return 'waiting';
}
