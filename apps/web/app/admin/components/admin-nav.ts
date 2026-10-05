import {
  LayoutDashboard, TrendingUp, Users, UserPlus, Shield, CalendarCheck, Gamepad2, Puzzle, SpellCheck, Swords,
  HeartHandshake, Trophy, Smile, CreditCard, DollarSign, Gift, Megaphone, BellRing, ToggleLeft, Library,
  Ghost, MessageSquareText, Activity, Rocket, BookOpen, Palette, type LucideIcon,
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
      { href: '/admin/metrics', label: 'Metrics', icon: TrendingUp, blurb: 'The Weekly Five: DAU, retention, shares, conversion' },
    ],
  },
  {
    title: 'Design',
    items: [
      { href: '/admin/art', label: 'Art Library', icon: Palette, blurb: 'Review art with JP: side-by-side previews, approvals, feedback' },
    ],
  },
  {
    title: 'Players',
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, blurb: 'Search players, Pro, bans, achievements' },
      { href: '/admin/onboarding', label: 'Onboarding', icon: UserPlus, blurb: 'New-player activation funnel' },
      { href: '/admin/moderation', label: 'Moderation', icon: Shield, blurb: 'Reports, bans, audit log' },
    ],
  },
  {
    title: 'Games & Puzzles',
    items: [
      { href: '/admin/daily', label: "Today's Dailies", icon: CalendarCheck, blurb: 'Plays, sweeps and the ten Puzzles today' },
      { href: '/admin/games', label: 'Games & Leaderboards', icon: Gamepad2, blurb: 'Daily boards, seeds, recent matches' },
      { href: '/admin/puzzles', label: 'Puzzle Analytics', icon: Puzzle, blurb: 'Difficulty, popularity, streak economy' },
      { href: '/admin/words', label: 'Word of the Day', icon: SpellCheck, blurb: 'Upcoming Word of the Day schedule' },
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
      { href: '/admin/achievements', label: 'Achievements & Levels', icon: Trophy, blurb: 'Catalog, unlock counts, level tiers' },
      { href: '/admin/avatars', label: 'Avatars', icon: Smile, blurb: 'Mascot maker adoption and favorites' },
    ],
  },
  {
    title: 'Monetization',
    items: [
      { href: '/admin/payments', label: 'Pro & Payments', icon: CreditCard, blurb: 'Pro members, Stripe, store events' },
      { href: '/admin/revenue', label: 'Revenue', icon: DollarSign, blurb: 'Subscriptions, ads, store revenue, expenses' },
      { href: '/admin/referrals', label: 'Referrals & Gifts', icon: Gift, blurb: 'Gift a week of Pro pipeline' },
    ],
  },
  {
    title: 'Growth',
    items: [
      { href: '/admin/marketing', label: 'Marketing', icon: Megaphone, blurb: 'Links, signups by source, shares, push campaigns' },
      { href: '/admin/messaging', label: 'Messaging', icon: BellRing, blurb: 'Announcements and push devices' },
    ],
  },
  {
    title: 'Content & Ops',
    items: [
      { href: '/admin/flags', label: 'Feature Flags', icon: ToggleLeft, blurb: 'Remote kill switches and launches' },
      { href: '/admin/banks', label: 'Content Banks', icon: Library, blurb: 'Puzzle bank runway per game' },
      { href: '/admin/seasons', label: 'Seasons', icon: Ghost, blurb: 'Halloween status and preview' },
      { href: '/admin/push-copy', label: 'Push Copy', icon: MessageSquareText, blurb: 'Preview every push message' },
    ],
  },
  {
    title: 'System',
    items: [
      { href: '/admin/ops', label: 'Ops Health', icon: Activity, blurb: 'Webhooks, anti-cheat, crons' },
      { href: '/admin/releases', label: 'Releases', icon: Rocket, blurb: 'Store links and release flow' },
      { href: '/admin/portal', label: 'Engineering Portal', icon: BookOpen, blurb: 'How Wordocious is built and works' },
    ],
  },
];

/** True when `href` is the active page for `pathname` (the Dashboard matches only itself). */
export function isActiveNav(href: string, pathname: string): boolean {
  return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`);
}
