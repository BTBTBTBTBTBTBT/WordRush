'use client';

import { useEffect } from 'react';
import { ART_SIZE, artSrc, type ArtName } from '@/lib/art';

// FINISH_SPEC BJ16 (founder 10-03: "There shouldn't be any plain text menus"): the 59 cast-color heading
// titles (art-titlecast-<slug>, docs/design/brand/TITLE-INVENTORY.md) drawn in place of every sheet / popup /
// page heading, with the words as the accessible name. Plain <img> of the shipped webp (no optimizer URL) so
// <HeadingArtWarmup/> (root layout) can decode the tap-presented ones at idle and the popup paints them warm.

export const HEADING_ART = {
  'solved': 'Solved!',
  'nottoday': 'Not Today',
  'share': 'Share',
  'sweep': 'Daily Sweep',
  'overview': 'Overview',
  'shields': 'Shields',
  'savestreak': 'Save Your Streak!',
  'streaksaved': 'Streak Saved!',
  'playedtoday': 'Played Today',
  'vsused': 'Daily VS Used',
  'achievement': 'Achievement Unlocked!',
  'letsplay': 'Let’s Play!',
  'invite': 'Invite a Friend',
  'editprofile': 'Edit Profile',
  'mascot': 'Make Your Mascot',
  'bots': 'Bots',
  'challenge': 'Challenge',
  'findingrival': 'Finding a Rival',
  'matchfound': 'Match Found!',
  'welcomeback': 'Welcome Back!',
  'jointhefun': 'Join the Fun!',
  'resetpassword': 'Reset Password',
  'makeprofile': 'Make Your Profile',
  'username': 'Pick a Username',
  'yourein': 'You’re In!',
  'tour-daily': 'Daily Games',
  'tour-score': 'Score Big',
  'tour-streak': 'Keep Your Streak',
  'tour-together': 'Play Together',
  'nudge': 'Nudge!',
  'invitesent': 'Invite Sent!',
  'newfriends': 'New Friends!',
  'giftpro': 'Gift a Week of Pro',
  'prounlocked': 'Pro Unlocked!',
  'invited': 'You’re Invited!',
  'yourepro': 'You’re Pro',
  'welcomepro': 'Welcome to Pro!',
  'freeweek': 'Free Week of Pro!',
  'properk': 'Pro Perk',
  'newpassword': 'New Password',
  'gauntletcleared': 'Gauntlet Cleared!',
  'laddercleared': 'Ladder Cleared!',
  'alreadyplayed': 'Already Played',
  'levelup': 'Level Up!',
  'archetypes': 'Archetypes',
  'h2h': 'Head to Head',
  'trophycase': 'Trophy Case',
  'podium': 'Podium',
  'streakcal': 'Streak Calendar',
  'support': 'Support',
  'about': 'About',
  'deleteaccount': 'Delete Account',
  'profile': 'Profile',
  'privatematch': 'Private Match',
  'oops': 'Oops!',
  'notfound': 'Not Found',
  'rotate': 'Rotate Your Phone',
  'dailychallenge': 'Daily Challenge',
  'onastreak': 'On a Streak!',
  'playwithfriends': 'Play with Friends',
  'more': 'More',
} as const;
export type HeadingSlug = keyof typeof HEADING_ART;

/** Titles that present on a tap (popups, sheets, result strips): decoded at idle after the first paint. */
export const HEADING_WARM: readonly HeadingSlug[] = ['solved', 'nottoday', 'share', 'sweep', 'shields', 'savestreak', 'streaksaved', 'playedtoday', 'vsused', 'achievement', 'letsplay', 'invite', 'editprofile', 'mascot', 'findingrival', 'matchfound', 'nudge', 'invitesent', 'newfriends', 'giftpro', 'prounlocked', 'invited', 'welcomepro', 'freeweek', 'properk', 'gauntletcleared', 'laddercleared', 'alreadyplayed', 'levelup', 'oops'];

/** Other lettering the header popups show on a tap (STREAK! / FLAWLESS!), decoded with the headings. */
const HEADING_WARM_EXTRA = ['art-moment-streak', 'art-moment-flawless'] as const;

/** Sheet / popup heading height (BJ16: 44–56 px) and widest draw. */
export const HEADING_HEIGHT = 48;
export const HEADING_MAX_WIDTH = 300;

/** The box a heading fills at `height` (≤ `maxWidth`); two-line art (aspect < 3.2) draws taller. */
export function headingBox(slug: HeadingSlug, height = HEADING_HEIGHT, maxWidth = HEADING_MAX_WIDTH): { w: number; h: number; aspect: number } {
  const [aw, ah] = ART_SIZE[`art-titlecast-${slug}` as ArtName];
  const aspect = aw / ah;
  const h = aspect < 3.2 ? height * 1.3 : height;
  const w = Math.min(maxWidth, h * aspect);
  return { w: Math.round(w), h: Math.round(w / aspect), aspect };
}

export function headingSrc(slug: HeadingSlug): string {
  return artSrc(`art-titlecast-${slug}`);
}

/**
 * A heading as its lettering: centered, `height` tall (≤ `maxWidth` and never wider than its room),
 * aspect kept. `as` / `level` like ArtTitle (a div announces the heading role at `level`).
 */
export function HeadingArt({ slug, label, height, maxWidth, as: Tag = 'div', level = 2, pop = true, align = 'center', id, bare = false, className = '', style }: {
  slug: HeadingSlug;
  /** Accessible name; defaults to the words the art draws. */
  label?: string;
  height?: number;
  maxWidth?: number;
  as?: 'h1' | 'h2' | 'h3' | 'div';
  level?: 1 | 2 | 3 | 4;
  /** The one-time title pop-in (art-pop); false for strips that animate themselves. */
  pop?: boolean;
  align?: 'center' | 'left';
  /** With `as="div"` inside an element that already is the heading (a DialogTitle): no heading role. */
  bare?: boolean;
  /** The heading element's id (aria-labelledby targets). */
  id?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [aw, ah] = ART_SIZE[`art-titlecast-${slug}` as ArtName];
  const { w } = headingBox(slug, height, maxWidth);
  return (
    <Tag
      id={id}
      {...(Tag === 'div' && !bare ? { role: 'heading' as const, 'aria-level': level } : null)}
      className={`flex ${align === 'center' ? 'justify-center' : 'justify-start'} m-0 select-none ${className}`}
      style={{ lineHeight: 0, ...style }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={headingSrc(slug)}
        alt={label || HEADING_ART[slug]}
        width={aw}
        height={ah}
        decoding="async"
        draggable={false}
        className={`block pointer-events-none ${pop ? 'art-pop' : ''}`}
        style={{ width: '100%', maxWidth: w, height: 'auto', aspectRatio: `${aw} / ${ah}` }}
      />
    </Tag>
  );
}

// Decoded images stay referenced so the browser keeps them in its decoded-image cache.
const held: HTMLImageElement[] = [];

/** BJ16: decode the tap-presented headings at idle, a few per slice (never a long task). */
export function HeadingArtWarmup() {
  useEffect(() => {
    if (held.length) return;
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const idle = (cb: () => void) => (ric ? ric.call(window, cb, { timeout: 3000 }) : setTimeout(cb, 1200));
    let i = 0;
    const step = () => {
      for (let n = 0; n < 6 && i < HEADING_WARM.length; n++, i++) {
        const img = new Image();
        img.decoding = 'async';
        img.src = headingSrc(HEADING_WARM[i]);
        img.decode().catch(() => {});
        held.push(img);
      }
      if (i < HEADING_WARM.length) idle(step);
      else for (const name of HEADING_WARM_EXTRA) {
        const img = new Image();
        img.decoding = 'async';
        img.src = artSrc(name);
        img.decode().catch(() => {});
        held.push(img);
      }
    };
    idle(step);
  }, []);
  return null;
}
