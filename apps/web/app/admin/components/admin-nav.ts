import {
  LayoutDashboard, TrendingUp, Users, CalendarCheck, Gamepad2, Puzzle, Swords,
  HeartHandshake, Trophy, CreditCard, DollarSign, Megaphone, BellRing, ToggleLeft,
  Ghost, Activity, Wrench, Palette, Clapperboard, AudioLines, type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** One line for the Dashboard's "Jump to" directory. */
  blurb: string;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

/**
 * The admin portal's one navigation map: the sidebar and the Dashboard's
 * directory both read it, so a new page is added in one place. Every route
 * under /admin is gated by middleware.ts (profiles.role = 'admin') and every
 * /api/admin route by verifyAdmin.
 */
export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, blurb: 'Key counts across the whole app' },
      { href: '/admin/metrics', label: 'Metrics', icon: TrendingUp, blurb: 'The Weekly Five (DAU, retention, shares, conversion) and new-player activation' },
    ],
  },
  {
    title: 'Monetization',
    items: [
      { href: '/admin/revenue', label: 'Revenue', icon: DollarSign, blurb: 'Subscriptions, ads, store revenue, expenses' },
      { href: '/admin/pro', label: 'Pro & Gifts', icon: CreditCard, blurb: 'Pro members, Stripe, gift-a-week invites, store events' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, blurb: 'Links, signups by source, shares' },
      { href: '/admin/studio', label: 'Social Studio', icon: Clapperboard, blurb: 'Marketing calendar: review posts with JP, they publish once both approve' },
      { href: '/admin/messaging', label: 'Messaging & Push', icon: BellRing, blurb: 'Announcements, push campaigns, push health, push copy' },
    ],
  },
  {
    title: 'Design',
    items: [
      { href: '/admin/art', label: 'Art Library', icon: Palette, blurb: 'Review art with JP: side-by-side previews, approvals, feedback' },
      { href: '/admin/sounds', label: 'Sound Library', icon: AudioLines, blurb: 'Every sound by game: what ships vs the options, picks with JP, feedback' },
    ],
  },
  {
    title: 'Players',
    items: [
      { href: '/admin/users', label: 'Users & Moderation', icon: Users, blurb: 'Search players, new accounts, bans, audit log' },
          ],
  },
  {
    title: 'Games & Puzzles',
    items: [
      { href: '/admin/daily', label: 'Dailies', icon: CalendarCheck, blurb: "Today's plays and sweeps, the Word of the Day schedule, bank runway" },
      { href: '/admin/games', label: 'Games & Leaderboards', icon: Gamepad2, blurb: 'Daily boards, seeds, recent matches' },
      { href: '/admin/puzzles', label: 'Puzzle Analytics', icon: Puzzle, blurb: 'Difficulty, popularity, streak economy' },
    ],
  },
  {
    title: 'Competition',
    items: [
      { href: '/admin/vs', label: 'VS & Bots', icon: Swords, blurb: 'Matches, challenges, the bot cast and ladder' },
    ],
  },
  {
    title: 'Social',
    items: [
      { href: '/admin/social', label: 'Friends & Pocket Games', icon: HeartHandshake, blurb: 'Friendships, pocket games, reactions, races' },
    ],
  },
  {
    title: 'Progression',
    items: [
      { href: '/admin/progression', label: 'Progression', icon: Trophy, blurb: 'Achievements, level tiers, mascot maker adoption' },
    ],
  },
  {
    title: 'Content & Ops',
    items: [
      { href: '/admin/flags', label: 'Feature Flags', icon: ToggleLeft, blurb: 'Remote kill switches and launches' },
      { href: '/admin/seasons', label: 'Seasons', icon: Ghost, blurb: 'Halloween status and preview' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/ops', label: 'Ops Health', icon: Activity, blurb: 'Webhooks, anti-cheat, crons' },
      { href: '/admin/engineering', label: 'Engineering', icon: Wrench, blurb: 'Store links, release flow, and how Wordocious is built' },
    ],
  },
];

/** True when `href` is the active page for `pathname` (the Dashboard matches only itself). */
export function isActiveNav(href: string, pathname: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}
