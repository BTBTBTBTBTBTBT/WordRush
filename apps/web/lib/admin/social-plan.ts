/**
 * JP's 45-day social plan (Wordocious Social Media Launch Plan, 12 Oct 2026), as typed static data for
 * admin > Growth > Social Studio. The Plan tab and the calendar's day cards read this file; nothing here
 * is fetched. Source: JP's plan doc + the 48-day calendar workbook, with the founder's later corrections
 * applied (see PLAN_UPDATES). Update the KPI `actual` fields at each Monday review.
 */

export type PlanPhaseId = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface PlanDay {
  /** YYYY-MM-DD */
  date: string;
  dow: string;
  phase: PlanPhaseId;
  /** D-2 .. D0 before launch, then 1..45. */
  dayNo: string;
  beat: string;
  /** Channel-by-channel plan. Empty string = nothing planned on that channel that day. */
  x: string;
  /** Short vertical video: TikTok, Instagram Reels, YouTube Shorts. */
  video: string;
  /** Instagram feed post. */
  ig: string;
  facebook: string;
  pinterest: string;
  /** Community / press task for the day. */
  community: string;
  cta: string;
  asset: string;
}

export const PLAN_OBJECTIVE =
  'Convert a finished 18-game suite into its first real audience over 45 days, using only owned channels, the built creative system and the in-product loops. Produce the first clean dataset (attributed installs, share rate, referral redemptions) the Weekly Five and the seed narrative need. Organic only: paid social stays gated until the business plan\'s Phase 2 retention gates.';

export const PLAN_WINDOW = { start: '2026-10-13', launch: '2026-10-16', end: '2026-11-29', label: 'Oct 13 to Nov 29, 2026', detail: 'Pre-launch Oct 13-15 · Launch Fri Oct 16 · Day 45 Sun Nov 29' };

export const PLAN_ANCHORS =
  '2.8 Halloween build (expedited review granted) · Halloween season in-app Oct 17-31 · icon and listing revert about Nov 1 · Thanksgiving build first week of Nov · themed puzzle days (Halloween Eve and Day, Diwali, Veterans Day, Thanksgiving Eve and Day)';

/** Founder decisions made after JP wrote the doc. Shown once, at the top of the Plan tab. */
export const PLAN_UPDATES: readonly string[] = [
  'Every actual holiday gets its own early branded greeting post at 7 AM CT with a custom mascot image, in addition to that day\'s planned posts: Happy Halloween (Oct 31), Feliz Día de los Muertos (Nov 2), Happy Diwali (Nov 8), Veterans Day (Nov 11), Happy Thanksgiving (Nov 26).',
  'Halloween has been on in the apps since 2.8 went live (season window Oct 9 to Oct 31, off Nov 1), not from Oct 17. The Oct 17 post is the social reveal of a look players already have.',
  'Instagram and TikTok are @playwordocious (JP\'s draft said @wordocious2). Threads is @playwordocious too.',
  'X is @wordocious. Facebook is facebook.com/wordocious. Pinterest is wordocious.',
  'Profile pictures are icon B (the W mascot), not the W tile.',
  'Publishing is automatic from Social Studio once BMT and JP both approve a post (the Studio cron). That replaces Buffer and native posting, so setup task S1 is superseded.',
  '"Owner: Jasson" on a day means JP reviews and approves the posts and runs the community and press tasks. Claude records the gameplay videos in the iPhone simulator (demo mode); the two family clips became mascot images.',
];

export const PLAN_ONE_RULE = {
  lead: 'Every post must do one of three jobs. Anything that does none of the three does not ship.',
  jobs: ['Make someone play today\'s puzzle.', 'Make a player share or invite.', 'Make the brand recognizable.'],
  note: 'Cadence beats polish: the calendar is sized so a missed day is recoverable and a missed week is visible at the Monday review.',
};

export const PLAN_MESSAGE_HOUSE = {
  roof: '18 daily games. One score. Bring your family.',
  pillars: [
    { name: 'Breadth', text: 'The daily-puzzle suite: 8 word dailies plus 10 Puzzles (logic, trivia, word) behind one account and one streak economy. Positioning only; never phrase it against another brand publicly.' },
    { name: 'Competition', text: 'The only daily puzzle you play head-to-head: live VS, the bot ladder (Rip to Webster), friend races, overtake pushes, weekly crowns.' },
    { name: 'Personality', text: 'The cast: ten letter-characters with faces, voices, costumes and a dressing room. An original brand in a genre of gray tiles.' },
  ],
  proof: 'Free daily everything · cross-platform (web, iOS, Android, same puzzle) · spoiler-free share cards · seasonal: the whole app dresses for Halloween',
};

export const PLAN_VOICE: readonly { title: string; text: string }[] = [
  { title: 'No emoji', text: 'The in-app rule extends to captions. The cast carries the personality; the absence of emoji is a brand signature. Caps headlines in the brand lettering (DOUBLE FLAWLESS!, MONDAY MASTERS).' },
  { title: 'Smack talk, never snark', text: 'The founding use case is family trash talk over the daily board. Captions taunt the reader into playing ("Your move."), never punch at competitors or players.' },
  { title: 'Never today\'s answers', text: 'Yesterday\'s Muddle cartoon, yesterday\'s podium, today\'s empty grid. Past puzzles only, anywhere, ever.' },
  { title: 'No competitor marks', text: 'None in handles, bios, hashtags or on-image text. Nominative editorial use only. Never show another product\'s UI in our videos.' },
  { title: 'American spelling', text: 'Color, center, gray, neighbor. No British spellings in any copy.' },
  { title: 'Exact Pro prices', text: '$6.99/mo, $59.99/yr, $1 day pass. Say "free" only where it is true (the core dailies are). No invented player counts or testimonials.' },
  { title: 'Hashtags', text: '#wordgames #dailypuzzle #puzzlegames, plus #wordocious.' },
];

export const PLAN_GUARDRAILS: readonly { area: string; rule: string }[] = [
  { area: 'Age posture (13+)', rule: 'No creative targeted at children, no school-adjacent placements, nothing that undermines the in-app age gate.' },
  { area: 'AI-generated art', rule: 'Mirror the store listings: label it where a platform asks (TikTok AIGC toggle). Never claim hand-drawn.' },
  { area: 'Audio', rule: 'Original synth pack, cast babble voices or the platform-licensed library only. No commercial tracks.' },
  { area: 'Paid', rule: 'No boosting or ads in this window. Gated by the business plan until the Phase 2 retention gates clear.' },
  { area: 'Reddit', rule: 'Participate for two weeks before any product mention. Mentions only where asked, flaired, or mod-approved, always disclosed as the founder. Never astroturf, never multiple accounts, never solicit reviews.' },
];

export interface PlanChannel {
  channel: string;
  handle: string;
  role: string;
  cadence: string;
  formats: string;
  /** Position in the "if a week collapses" order: 1 drops first. null = never drops. */
  dropOrder: string;
}

export const PLAN_CHANNELS: readonly PlanChannel[] = [
  { channel: 'TikTok', handle: '@playwordocious', role: 'Discovery engine #1: cast and gameplay', cadence: '4 per week', formats: '15-30s vertical: game spotlights, cast skits, Halloween reveal, satisfying solves', dropOrder: 'Never drops' },
  { channel: 'Instagram', handle: '@playwordocious', role: 'Brand home: the feed is the portfolio, Stories are the daily pulse', cadence: 'Feed 3 per week, Stories on beat days', formats: 'Reels (same as TikTok), Meet-the-Cast carousel, podium and board shares, WOTD quiz stickers', dropOrder: 'Drops 4th (feed)' },
  { channel: 'X', handle: '@wordocious', role: 'Daily ritual and word-game community', cadence: '1-2 per day, lightweight', formats: 'WOTD quiz (answer in replies), day-title posts, board shares, founder commentary', dropOrder: 'Never drops' },
  { channel: 'YouTube Shorts', handle: 'wordocious', role: 'Zero-extra-cost syndication of TikTok cuts', cadence: '3 per week crosspost', formats: 'Same vertical videos', dropOrder: 'Drops 3rd' },
  { channel: 'Facebook', handle: 'facebook.com/wordocious', role: 'Family-organizer audience and share destination', cadence: '3 per week crosspost', formats: 'Instagram content plus weekly race and family angles', dropOrder: 'Drops 2nd' },
  { channel: 'Pinterest', handle: 'wordocious', role: 'Evergreen puzzle-audience search', cadence: '3 pins per week', formats: 'Game explainers, WOTD word cards, cast art, "games like" boards', dropOrder: 'Drops 1st' },
  { channel: 'Reddit', handle: 'founder accounts', role: 'Community seeding: participation, not promotion (80/20)', cadence: '3 touchpoints per week', formats: 'Comments; rare disclosed mentions in r/puzzles, r/AndroidGaming, r/iosgaming and the daily-word-game subs', dropOrder: 'Never drops' },
  { channel: 'LinkedIn', handle: 'JP personal', role: 'Press and investor surface', cadence: '1 per week', formats: 'Build-in-public milestones, launch story', dropOrder: 'As needed' },
  { channel: 'Threads', handle: '@playwordocious', role: 'Handle held; not in JP\'s draft', cadence: 'None planned', formats: 'None planned', dropOrder: 'Not in the order' },
];

export const PLAN_COLLAPSE_NOTE =
  'Net production load: 4 vertical videos, 3 feed graphics, about 10 lightweight X posts and 3 pins per week; everything else is crossposting. If a week collapses, drop in this order: Pinterest, Facebook, YouTube, Instagram feed. TikTok, X daily and the Monday and Sunday ritual posts never drop.';

export interface PlanPillar { id: string; name: string; share: number; text: string }

export const PLAN_PILLARS: readonly PlanPillar[] = [
  { id: 'P1', name: 'Daily ritual and competition', share: 25, text: 'Day titles (Monday Masters to Sunday Superstars), weekly race resets, sweep boards, podiums, streaks.' },
  { id: 'P2', name: 'Cast and brand', share: 20, text: 'Meet the Cast, bot-ladder lore (beat Webster), mascot Dressing Room, seasonal costumes.' },
  { id: 'P3', name: 'Game spotlights', share: 20, text: '"18 Days of Wordocious": one game per episode, a 15s how-it-plays plus one strategy beat.' },
  { id: 'P4', name: 'Puzzle content as content', share: 20, text: 'WOTD quiz, yesterday\'s Muddle cartoon reveal, Hubbub pangram tease, first-party word-data facts.' },
  { id: 'P5', name: 'Seasonal arcs', share: 10, text: 'Halloween dress-up, icon revert, Thanksgiving kit, holiday puzzle days.' },
  { id: 'P6', name: 'Founder and build-in-public', share: 5, text: 'The origin (family smack talk), the 10-week build story, milestone posts in JP\'s LinkedIn and X voice.' },
];

export const PLAN_WEEK: readonly { day: string; ritual: string; production: string }[] = [
  { day: 'Monday', ritual: 'MONDAY MASTERS: weekly race reset. "New week. Zero points. Crown\'s open." Plus last week\'s champion shoutout.', production: 'Batch A: write the week\'s captions, schedule X. 30-minute Monday review of last week\'s numbers.' },
  { day: 'Tuesday', ritual: 'WOTD quiz', production: 'Video 1 ships (game spotlight)' },
  { day: 'Wednesday', ritual: 'MUDDLE WEDNESDAY: yesterday\'s cartoon, "caption this" and punchline reveal thread', production: 'Feed graphic ships' },
  { day: 'Thursday', ritual: 'WOTD quiz plus Hubbub pangram tease ("today\'s letters hide a 7-letter word")', production: 'Video 2 ships. Batch B: capture and cut next week\'s videos.' },
  { day: 'Friday', ritual: 'FRIDAY\'S FINEST: the week\'s best board or streak (player shares once they exist; founder\'s until then)', production: 'Video 3 ships; pins scheduled' },
  { day: 'Saturday', ritual: 'Cast content and seasonal beat', production: 'Video 4 ships (lighter, cast-led)' },
  { day: 'Sunday', ritual: 'SWEEP SUNDAY: "can you sweep all 18?" plus the sweep board share card', production: 'Rest; community replies only' },
];

export const PLAN_SERIES: readonly { name: string; text: string }[] = [
  { name: '18 Days of Wordocious', text: 'One game per episode. Screen capture from the demo-shot harness; caption is one rule plus one hook; end card is the game\'s title art plus "free daily, link in bio." Lead with the most visual (OctoWord cascade, Muddle, Starsweep, Hubbub); save the classic format for the comparison episode.' },
  { name: 'Meet the Cast', text: 'The 10-slide carousel, run as individual character posts twice a week with the bot-persona angle. Finish with the full-cast group shot before Thanksgiving.' },
  { name: 'WOTD quiz', text: 'X-native. Morning post: the word plus three definition choices. Evening reply: the answer plus the in-app streak pitch. Zero design cost.' },
  { name: 'Beat Webster', text: 'A standing challenge: clips of ladder matches. First player to clear the ladder gets their mascot featured. The UGC engine once players exist.' },
];

export interface PlanPhase {
  id: PlanPhaseId;
  name: string;
  start: string;
  end: string;
  theme: string;
  beats: string;
  /** Tailwind classes: calendar strip, and legend/pill. */
  strip: string;
  pill: string;
}

export const PLAN_PHASES: readonly PlanPhase[] = [
  { id: 'P0', name: 'Setup and tease', start: '2026-10-13', end: '2026-10-15', theme: '"18 games. 4 days."', beats: 'S1-S7 complete; three countdown teasers; press list emails drafted.', strip: 'bg-slate-400', pill: 'bg-slate-100 text-slate-700' },
  { id: 'P1', name: 'Launch week', start: '2026-10-16', end: '2026-10-22', theme: 'The suite announcement and the Halloween transformation', beats: 'Oct 16 launch across all channels plus press emails. Oct 17 Halloween flips in-app ("the app dressed itself" reveal). Oct 18-22 Meet the Cast begins, Reddit participation starts, 18 Days episodes 1-3.', strip: 'bg-violet-500', pill: 'bg-violet-100 text-violet-700' },
  { id: 'P2', name: 'Halloween arc', start: '2026-10-23', end: '2026-10-31', theme: 'Costumes, candy, competition', beats: 'Oct 27 Product Hunt launch (app fully dressed). Oct 28-30 mascot costume UGC push. Oct 30-31 Halloween Eve and Halloween themed puzzles across every game: the biggest content days of the window.', strip: 'bg-fuchsia-500', pill: 'bg-fuchsia-100 text-fuchsia-700' },
  { id: 'P3', name: 'Reset and rebuild', start: '2026-11-01', end: '2026-11-13', theme: 'Back to purple; the games carry it', beats: 'Nov 1 icon reverts ("the cast cleans up"). Nov 8 Diwali themed puzzles. Nov 10 Product Hunt fallback slot if Oct 27 slipped. Nov 11 Veterans Day themed puzzles. 18 Days episodes continue; first "player of the week" reposts.', strip: 'bg-sky-500', pill: 'bg-sky-100 text-sky-700' },
  { id: 'P4', name: 'Thanksgiving arc', start: '2026-11-14', end: '2026-11-29', theme: 'The family game, at the family table', beats: 'Mid-Nov Thanksgiving build ships (second transformation reveal). Nov 17-24 "start the family league before Thursday" push. Nov 25-26 Thanksgiving Eve and Day themed puzzles. Nov 27 annual Pro positioning ($59.99 = $5/mo, 18 games; message only, no discount). Nov 28-29 45-day wrap and December preview.', strip: 'bg-teal-500', pill: 'bg-teal-100 text-teal-700' },
];

export interface PlanKpi {
  id: string;
  label: string;
  source: string;
  kind: 'count' | 'percent' | 'text';
  /** Targets by checkpoint (text rows hold the words). */
  target: { d15: number | string; d30: number | string; d45: number | string };
  /** Actuals, filled at the Monday review. null until then. */
  actual: { d15: number | string | null; d30: number | string | null; d45: number | string | null };
}

export const PLAN_CHECKPOINTS: readonly { key: 'd15' | 'd30' | 'd45'; label: string; date: string }[] = [
  { key: 'd15', label: 'Day 15', date: '2026-10-30' },
  { key: 'd30', label: 'Day 30', date: '2026-11-14' },
  { key: 'd45', label: 'Day 45', date: '2026-11-29' },
];

const noActual = { d15: null, d30: null, d45: null } as const;

export const PLAN_KPIS: readonly PlanKpi[] = [
  { id: 'posts', label: 'Posts published (all channels)', source: 'Calendar status column', kind: 'count', target: { d15: 45, d30: 95, d45: 150 }, actual: noActual },
  { id: 'followers', label: 'Combined followers', source: 'Platform analytics', kind: 'count', target: { d15: 300, d30: 900, d45: 1800 }, actual: noActual },
  { id: 'installs', label: 'Social-attributed installs and signups', source: 'Admin Marketing (attribution links, signup_source)', kind: 'count', target: { d15: 150, d30: 450, d45: 900 }, actual: noActual },
  { id: 'referrals', label: 'Referral redemptions from social CTAs', source: 'Admin Referrals', kind: 'count', target: { d15: 25, d30: 75, d45: 150 }, actual: noActual },
  { id: 'share', label: 'Share rate (shares per win, product-wide)', source: 'Weekly Five', kind: 'percent', target: { d15: 5, d30: 6.5, d45: 8 }, actual: noActual },
  { id: 'videos', label: 'Short-form videos over 5,000 views', source: 'Platform analytics', kind: 'count', target: { d15: 1, d30: 3, d45: 6 }, actual: noActual },
  { id: 'press', label: 'Press and newsletter placements', source: 'Manual log', kind: 'count', target: { d15: 1, d30: 2, d45: 3 }, actual: noActual },
  { id: 'ph', label: 'Product Hunt', source: 'Top-10 day goal', kind: 'text', target: { d15: '-', d30: 'Launched (Tue Oct 27; fallback Nov 10)', d45: 'Top-10 of the day' }, actual: noActual },
];

export const PLAN_KPI_NOTE =
  'Working targets, not promises: the channels have no history, so the Week 2 Monday review re-bases them against actuals. Fill the actuals at each Monday review. A variance over 25% on installs or share rate gets a one-line written cause. Kill rule: a series under 1% engagement across 4 consecutive posts is replaced; a video over 5x median views gets 3 follow-on variants within a week.';

export type SetupStatus = 'done' | 'in progress' | 'pending' | 'n/a';

export interface PlanLink {
  label: string;
  /** Absolute URL. */
  href: string;
}

export interface PlanTask {
  id: string;
  task: string;
  owner: 'JP' | 'BMT';
  status: SetupStatus;
  /** YYYY-MM-DD the task was finished (or, for n/a, superseded). Null until then. */
  doneOn: string | null;
  /** One line on where it stands now. */
  note: string;
  /** Live things worth opening: the bio URL, the board URL, the pinned post. Add them here when they exist. */
  links: readonly PlanLink[];
  /** Launch-kit doc ids (lib/admin/launch-kit.ts) that carry this task's drafts. */
  kit?: readonly string[];
}

/**
 * Setup tasks S1-S7 and their live status. THE ONE ARRAY TO UPDATE as work lands: change `status`, set `doneOn`,
 * rewrite `note`, add `links`. The Plan tab's "Launch setup" checklist reads it directly.
 */
export const PLAN_SETUP: readonly PlanTask[] = [
  {
    id: 'S1', owner: 'JP', status: 'n/a', doneOn: '2026-10-14',
    task: 'Map the posting tool to the channel accounts.',
    note: 'Superseded: accounts connect in Social Studio (Accounts tab) and posts publish from there once BMT and JP approve.',
    links: [],
  },
  {
    id: 'S2', owner: 'JP', status: 'in progress', doneOn: null,
    task: 'Install the social package: profile pictures (icon B, the W mascot), X header, FB cover, IG highlight covers, TikTok and YouTube banners, Pinterest boards, LinkedIn covers.',
    note: 'Done 10-14: icon B profile pictures on Facebook, Instagram, TikTok, X and Pinterest; Facebook cover; X header; Pinterest boards Daily Games, Meet the Cast and Game Guides. Left: IG highlight covers (designed, in review), YouTube banner and LinkedIn covers (those accounts are not set up yet).',
    links: [
      { label: 'X', href: 'https://x.com/wordocious' },
      { label: 'Instagram', href: 'https://instagram.com/playwordocious' },
      { label: 'TikTok', href: 'https://tiktok.com/@playwordocious' },
      { label: 'Facebook', href: 'https://facebook.com/wordocious' },
      { label: 'Pinterest', href: 'https://pinterest.com/wordocious' },
      { label: 'Board: Daily Games', href: 'https://www.pinterest.com/wordocious/daily-games/' },
      { label: 'Board: Meet the Cast', href: 'https://www.pinterest.com/wordocious/meet-the-cast/' },
      { label: 'Board: Game Guides', href: 'https://www.pinterest.com/wordocious/game-guides/' },
    ],
  },
  {
    id: 'S3', owner: 'BMT', status: 'in progress', doneOn: null,
    task: 'Bios: one line ("18 daily games. One score.") plus the wordocious.com link carrying a per-channel attribution parameter from admin Marketing. Verify the landing-visit beacons fire.',
    note: 'Live 10-14 on X, Instagram, TikTok, Facebook and Pinterest, each with its own /go link (TikTok and Facebook carry it in the bio text). Instagram\'s link ("Play free", /go/instagram) was added by the founder in the app 10-14. Left: Threads, YouTube and LinkedIn wait for those profiles.',
    links: [
      { label: 'X', href: 'https://x.com/wordocious' },
      { label: 'Instagram', href: 'https://instagram.com/playwordocious' },
      { label: 'TikTok', href: 'https://tiktok.com/@playwordocious' },
      { label: 'Facebook', href: 'https://facebook.com/wordocious' },
      { label: 'Pinterest', href: 'https://pinterest.com/wordocious' },
      { label: 'Channel links and clicks (Marketing)', href: '/admin/marketing' },
    ],
    kit: ['bios'],
  },
  {
    id: 'S4', owner: 'JP', status: 'pending', doneOn: null,
    task: 'Pinned posts: launch trailer (X, FB) and Meet-the-Cast slide 1 (IG).',
    note: 'Waits for the launch posts on Oct 16. Add the pinned-post URLs below when they are live.',
    links: [],
    kit: ['founder-posts'],
  },
  {
    id: 'S5', owner: 'BMT', status: 'in progress', doneOn: null,
    task: 'Capture kit: run the -storeShot set plus 5 raw screen recordings (Classic solve, OctoWord reveal cascade, VS match vs a bot, Muddle solve, Halloween opening animation) into a shared folder.',
    note: 'Recordings are being captured from the demo-shot harness (docs/design/brand/social/jp45/video).',
    links: [],
  },
  {
    id: 'S6', owner: 'JP', status: 'in progress', doneOn: null,
    task: 'Press one-pager PDF plus a 15-name list (puzzle newsletters, indie-game press, daily-word-game writers). Product Hunt assets drafted, hunter confirmed.',
    note: 'Drafted 10-14: one-pager, 15-target press list, four emails, Product Hunt copy, founder posts. One-pager PDF built (docs/marketing/jp45). Open: JP edits, hunter confirmation, YouTuber names.',
    links: [],
    kit: ['press-one-pager', 'press-list', 'press-emails', 'product-hunt'],
  },
  {
    id: 'S7', owner: 'JP', status: 'in progress', doneOn: null,
    task: 'Teasers: 3 countdown posts Oct 13-15 (cast silhouettes, "18 games. 4 days."). The only pre-launch content.',
    note: 'Oct 13 and Oct 14 teasers are past. The Oct 15 teaser is drafted with art; it goes out with approval.',
    links: [{ label: 'Open Oct 15 on the calendar', href: '/admin/studio?tab=calendar' }],
  },
];

export interface AccountChange { date: string; channel: string; change: string }

/** Live changes made on the real accounts, newest first. Append at the top whenever an account is touched. */
export const PLAN_ACCOUNT_LOG: readonly AccountChange[] = [
  { date: '2026-10-14', channel: 'Instagram', change: 'Link added in the app by the founder: "Play free" → https://wordocious.com/go/instagram.' },
  { date: '2026-10-14', channel: 'Pinterest', change: 'Boards created: Daily Games, Meet the Cast, Game Guides. Profile About rewritten; website https://wordocious.com/go/pinterest.' },
  { date: '2026-10-14', channel: 'Facebook', change: 'Bio: "18 daily games. One score. Bring your family. Play free at wordocious.com/go/facebook".' },
  { date: '2026-10-14', channel: 'TikTok', change: 'Bio: "18 daily games. One score. A cast with opinions. wordocious.com/go/tiktok" (no clickable link field on this account yet).' },
  { date: '2026-10-14', channel: 'Instagram', change: 'Bio: "18 daily games. One score. A cast with opinions. Free. Link below." Website link pending (phone app only).' },
  { date: '2026-10-14', channel: 'X', change: 'Bio: "18 daily games. One score. Free on web, iOS and Android. Your move." Website already /go/x.' },
  { date: '2026-10-14', channel: 'Marketing', change: 'Tracked links added for LinkedIn, Product Hunt and press (/go/linkedin, /go/producthunt, /go/press); the other eight channel links already existed.' },
  { date: '2026-10-14', channel: 'Pinterest', change: 'JP invited as Manager (jp@pattersonlp.com).' },
  { date: '2026-10-14', channel: 'TikTok', change: 'TikTok Business Center created and JP invited.' },
  { date: '2026-10-14', channel: 'Instagram', change: 'Connected to the Facebook Page.' },
  { date: '2026-10-14', channel: 'Instagram and TikTok', change: 'Handles changed to @playwordocious (@wordocious is held by dormant accounts).' },
  { date: '2026-10-14', channel: 'X', change: 'Header refreshed.' },
  { date: '2026-10-14', channel: 'Facebook', change: 'Cover refreshed; Page username set to wordocious.' },
  { date: '2026-10-14', channel: 'Facebook, Instagram, TikTok, X, Pinterest', change: 'Profile pictures set to icon B (the W mascot).' },
];

export interface CopySlot { slot: string; copy: string }

/** Appendix A: ready-to-post openers. Links always carry the channel's attribution parameter. */
export const PLAN_COPY_PACK: readonly CopySlot[] = [
  { slot: 'Launch (X thread, post 1)', copy: 'We built one daily word game so our family could trash-talk each other. Then it got out of hand. Today: 18 daily games. One score. Live head-to-head. Free on web, iOS and Android. WORDOCIOUS.' },
  { slot: 'Launch (TikTok and Instagram caption)', copy: '18 daily puzzles. One scoreboard. A cast with opinions. Free. Your move.' },
  { slot: 'Halloween reveal (Oct 17)', copy: 'We did not update the app. The app got dressed. Halloween is live through Oct 31: costumes, haunted glass, the works.' },
  { slot: 'Sweep Sunday', copy: 'All 18 dailies. One day. Nobody has swept it yet. SWEEP SUNDAY starts now.' },
  { slot: 'Monday Masters', copy: 'New week. Zero points. The crown is open. MONDAY MASTERS.' },
  { slot: 'Muddle Wednesday', copy: 'Yesterday\'s Muddle. Four words, one punchline, one cartoon. Caption it before you scroll.' },
  { slot: 'WOTD quiz (X, morning)', copy: 'Today\'s word: [WORD]. It means: (a) ... (b) ... (c) ... No lookups. Answer tonight.' },
  { slot: 'Beat Webster', copy: 'Ten bots. Rip is a pushover. Webster is not. Nobody has cleared the ladder. First to do it gets their mascot on our feed.' },
  { slot: 'Costume contest (Oct 28)', copy: 'Dress your mascot. Share the card. Three best costumes get featured Friday. The pumpkin hat is free all week.' },
  { slot: 'Thanksgiving (Nov 17+)', copy: 'Thanksgiving rule: whoever loses the family league does the dishes. Set up your league before Thursday: invites are one link.' },
];

/** The channel rows of a day card, in display order. */
export const PLAN_DAY_CHANNELS: readonly { key: 'x' | 'video' | 'ig' | 'facebook' | 'pinterest'; label: string }[] = [
  { key: 'x', label: 'X' },
  { key: 'video', label: 'Video (TikTok, Reels, Shorts)' },
  { key: 'ig', label: 'Instagram feed' },
  { key: 'facebook', label: 'Facebook' },
  { key: 'pinterest', label: 'Pinterest' },
];

/** Who reviews and who captures (see PLAN_UPDATES). */
export const PLAN_DAY_OWNER = 'JP reviews and approves, and runs the community and press task. Brian (BMT) captures video.';

export const PLAN_DAYS: readonly PlanDay[] = [
  {"date": "2026-10-13", "dow": "Tue", "phase": "P0", "dayNo": "D-2", "beat": "Teaser 1 — \"18 games. 3 days.\" (cast silhouettes)", "x": "Teaser 1", "video": "18 Days episode ships", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "S1-S7 setup sprint begins", "cta": "bio link (channel tag)", "asset": "social package"},
  {"date": "2026-10-14", "dow": "Wed", "phase": "P0", "dayNo": "D-1", "beat": "Teaser 2 — cast silhouette reveal", "x": "Teaser 2", "video": "", "ig": "Feed: cartoon + reveal thread", "facebook": "Cartoon post", "pinterest": "", "community": "Press list final; PH assets final", "cta": "bio link (channel tag)", "asset": "social package"},
  {"date": "2026-10-15", "dow": "Thu", "phase": "P0", "dayNo": "D0", "beat": "Teaser 3 — \"Tomorrow.\"", "x": "Teaser 3", "video": "18 Days episode ships", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Buffer mapping (S1) done or native-posting fallback confirmed", "cta": "bio link (channel tag)", "asset": "social package"},
  {"date": "2026-10-16", "dow": "Fri", "phase": "P1", "dayNo": "1", "beat": "LAUNCH DAY — 18 games, one score", "x": "Launch thread (family origin story)", "video": "Launch trailer 30s — all channels", "ig": "Feed: trailer + carousel slide 1", "facebook": "Launch post + cover live", "pinterest": "", "community": "Press emails 8am PT; LinkedIn launch story", "cta": "bio links live w/ channel tags", "asset": "trailer cut from storeShot set"},
  {"date": "2026-10-17", "dow": "Sat", "phase": "P1", "dayNo": "2", "beat": "HALLOWEEN FLIPS IN-APP (Oct 17-31)", "x": "\"The app got dressed.\"", "video": "Halloween reveal — opening animation + haunted glass", "ig": "Stories: full walkthrough", "facebook": "Crosspost reveal", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "screen recording of season flip"},
  {"date": "2026-10-18", "dow": "Sun", "phase": "P1", "dayNo": "3", "beat": "SWEEP SUNDAY debut", "x": "Sweep board + challenge", "video": "", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Reddit participation starts (no links, 2 weeks)", "cta": "bio link (channel tag)", "asset": "sweep share card"},
  {"date": "2026-10-19", "dow": "Mon", "phase": "P1", "dayNo": "4", "beat": "MONDAY MASTERS debut", "x": "Race-reset post + last week champion", "video": "", "ig": "Story: race reset", "facebook": "", "pinterest": "", "community": "Monday review #1 — launch numbers vs targets", "cta": "bio link (channel tag)", "asset": "mon-masters title art"},
  {"date": "2026-10-20", "dow": "Tue", "phase": "P1", "dayNo": "5", "beat": "WOTD quiz day", "x": "WOTD quiz debut", "video": "18 Days ep.1 — OctoWord cascade", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "storeShot capture"},
  {"date": "2026-10-21", "dow": "Wed", "phase": "P1", "dayNo": "6", "beat": "MUDDLE WEDNESDAY debut", "x": "Yesterday's cartoon — caption this", "video": "", "ig": "Feed: cartoon + reveal thread", "facebook": "Cartoon post", "pinterest": "Seed 3 boards: Daily Games / Cast / Guides", "community": "", "cta": "bio link (channel tag)", "asset": "Muddle cartoon bank"},
  {"date": "2026-10-22", "dow": "Thu", "phase": "P1", "dayNo": "7", "beat": "WOTD + Hubbub pangram tease", "x": "WOTD quiz + pangram tease", "video": "18 Days ep.2 — Starsweep", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Invite 20 friends/family to follow+share; PH hunter confirmed", "cta": "bio link (channel tag)", "asset": "WOTD card / Hubbub"},
  {"date": "2026-10-23", "dow": "Fri", "phase": "P2", "dayNo": "8", "beat": "FRIDAY'S FINEST — best board", "x": "Best board/streak of the week", "video": "18 Days episode ships", "ig": "Feed: Friday's Finest", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "bio link (channel tag)", "asset": "share cards"},
  {"date": "2026-10-24", "dow": "Sat", "phase": "P2", "dayNo": "9", "beat": "Cast Saturday — bot ladder lore (\"Beat Webster\")", "x": "Cast post", "video": "Cast-led video ships", "ig": "Story: cast", "facebook": "", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "cast art"},
  {"date": "2026-10-25", "dow": "Sun", "phase": "P2", "dayNo": "10", "beat": "SWEEP SUNDAY — sweep all 18", "x": "Sweep board + challenge", "video": "", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Replies only", "cta": "bio link (channel tag)", "asset": "sweep share card"},
  {"date": "2026-10-26", "dow": "Mon", "phase": "P2", "dayNo": "11", "beat": "MONDAY MASTERS — race reset", "x": "Race-reset post + last week champion", "video": "", "ig": "Story: race reset", "facebook": "", "pinterest": "", "community": "PH eve: listing final, maker comment drafted", "cta": "bio link (channel tag)", "asset": "mon-masters title art"},
  {"date": "2026-10-27", "dow": "Tue", "phase": "P2", "dayNo": "12", "beat": "PRODUCT HUNT LAUNCH (fallback Nov 10)", "x": "PH live — all channels point at listing", "video": "PH-day cut: 18 games in 30s", "ig": "Feed+Story: PH", "facebook": "PH post", "pinterest": "", "community": "Founder maker-comment; reply all day", "cta": "PH listing link", "asset": "storeShot capture"},
  {"date": "2026-10-28", "dow": "Wed", "phase": "P2", "dayNo": "13", "beat": "Costume contest opens (Oct 28-30)", "x": "\"Dress your mascot\" brief", "video": "", "ig": "Feed: contest brief + examples", "facebook": "Cartoon post", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "Dressing Room captures"},
  {"date": "2026-10-29", "dow": "Thu", "phase": "P2", "dayNo": "14", "beat": "WOTD + Hubbub pangram tease", "x": "Contest reminders + entries repost", "video": "18 Days episode ships", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Batch capture day (Brian)", "cta": "bio link (channel tag)", "asset": "WOTD card / Hubbub"},
  {"date": "2026-10-30", "dow": "Fri", "phase": "P2", "dayNo": "15", "beat": "HALLOWEEN EVE themed puzzles (all games)", "x": "Themed-puzzle day post", "video": "Halloween Eve special — themed boards montage", "ig": "Feed: Friday's Finest", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "bio link (channel tag)", "asset": "holiday title art (HEROES)"},
  {"date": "2026-10-31", "dow": "Sat", "phase": "P2", "dayNo": "16", "beat": "HALLOWEEN — themed puzzles + contest winners", "x": "Winners featured; Halloween board", "video": "Cast-led video ships", "ig": "Feed: 3 winning mascots", "facebook": "Winners", "pinterest": "", "community": "Last day of season window", "cta": "bio link (channel tag)", "asset": "winner share cards"},
  {"date": "2026-11-01", "dow": "Sun", "phase": "P3", "dayNo": "17", "beat": "ICON REVERTS (~2.8.x) — \"the cast cleans up\"", "x": "Before/after icon post", "video": "\"Cleaning up\" cast gag", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Replies only", "cta": "bio link (channel tag)", "asset": "icon art A/B"},
  {"date": "2026-11-02", "dow": "Mon", "phase": "P3", "dayNo": "18", "beat": "MONDAY MASTERS — race reset", "x": "Race-reset post + last week champion", "video": "", "ig": "Story: race reset", "facebook": "", "pinterest": "", "community": "Monday review: fill KPI tab", "cta": "bio link (channel tag)", "asset": "mon-masters title art"},
  {"date": "2026-11-03", "dow": "Tue", "phase": "P3", "dayNo": "19", "beat": "WOTD quiz day", "x": "WOTD quiz AM / answer PM", "video": "18 Days episode ships", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "storeShot capture"},
  {"date": "2026-11-04", "dow": "Wed", "phase": "P3", "dayNo": "20", "beat": "MUDDLE WEDNESDAY", "x": "Yesterday's cartoon — caption this", "video": "", "ig": "Feed: cartoon + reveal thread", "facebook": "Cartoon post", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "Muddle cartoon bank"},
  {"date": "2026-11-05", "dow": "Thu", "phase": "P3", "dayNo": "21", "beat": "WOTD + Hubbub pangram tease", "x": "WOTD quiz + pangram tease", "video": "18 Days episode ships", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Batch capture day (Brian)", "cta": "bio link (channel tag)", "asset": "WOTD card / Hubbub"},
  {"date": "2026-11-06", "dow": "Fri", "phase": "P3", "dayNo": "22", "beat": "FRIDAY'S FINEST — best board", "x": "Best board/streak of the week", "video": "18 Days episode ships", "ig": "Feed: Friday's Finest", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "bio link (channel tag)", "asset": "share cards"},
  {"date": "2026-11-07", "dow": "Sat", "phase": "P3", "dayNo": "23", "beat": "Cast / seasonal day", "x": "Cast post", "video": "Cast-led video ships", "ig": "Story: cast", "facebook": "", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "cast art"},
  {"date": "2026-11-08", "dow": "Sun", "phase": "P3", "dayNo": "24", "beat": "DIWALI themed puzzles", "x": "Diwali HEROES title + themed boards", "video": "", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Replies only", "cta": "bio link (channel tag)", "asset": "holiday title art"},
  {"date": "2026-11-09", "dow": "Mon", "phase": "P3", "dayNo": "25", "beat": "MONDAY MASTERS — race reset", "x": "Race-reset post + last week champion", "video": "", "ig": "Story: race reset", "facebook": "", "pinterest": "", "community": "Monday review: fill KPI tab", "cta": "bio link (channel tag)", "asset": "mon-masters title art"},
  {"date": "2026-11-10", "dow": "Tue", "phase": "P3", "dayNo": "26", "beat": "PH fallback slot (only if Oct 27 slipped)", "x": "WOTD quiz AM / answer PM", "video": "18 Days episode ships", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "Else: press pitch #2 scheduled", "cta": "bio link (channel tag)", "asset": "storeShot capture"},
  {"date": "2026-11-11", "dow": "Wed", "phase": "P3", "dayNo": "27", "beat": "VETERANS DAY themed puzzles", "x": "Themed boards post", "video": "", "ig": "Feed: cartoon + reveal thread", "facebook": "Cartoon post", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "Muddle cartoon bank"},
  {"date": "2026-11-12", "dow": "Thu", "phase": "P3", "dayNo": "28", "beat": "WOTD + Hubbub pangram tease", "x": "WOTD quiz + pangram tease", "video": "18 Days episode ships", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Batch capture day (Brian)", "cta": "bio link (channel tag)", "asset": "WOTD card / Hubbub"},
  {"date": "2026-11-13", "dow": "Fri", "phase": "P3", "dayNo": "29", "beat": "First \"Player of the Week\" repost (if UGC exists)", "x": "Best board/streak of the week", "video": "18 Days episode ships", "ig": "Feed: player feature", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "bio link (channel tag)", "asset": "share cards"},
  {"date": "2026-11-14", "dow": "Sat", "phase": "P4", "dayNo": "30", "beat": "Cast / seasonal day", "x": "Cast post", "video": "Cast-led video ships", "ig": "Story: cast", "facebook": "", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "cast art"},
  {"date": "2026-11-15", "dow": "Sun", "phase": "P4", "dayNo": "31", "beat": "SWEEP SUNDAY — sweep all 18", "x": "Sweep board + challenge", "video": "", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Replies only", "cta": "bio link (channel tag)", "asset": "sweep share card"},
  {"date": "2026-11-16", "dow": "Mon", "phase": "P4", "dayNo": "32", "beat": "THANKSGIVING BUILD REVEAL (date = build ship; adjust)", "x": "\"The app knows what month it is. Again.\"", "video": "Transformation reveal #2 — Thanksgiving kit", "ig": "Stories walkthrough", "facebook": "", "pinterest": "", "community": "Monday review: fill KPI tab", "cta": "bio link (channel tag)", "asset": "season flip recording"},
  {"date": "2026-11-17", "dow": "Tue", "phase": "P4", "dayNo": "33", "beat": "Family-league push opens (thru Nov 24)", "x": "\"Set up the family league before Thursday\"", "video": "18 Days episode ships", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "Press pitch #3: \"the app for the family table\"", "cta": "bio link (channel tag)", "asset": "storeShot capture"},
  {"date": "2026-11-18", "dow": "Wed", "phase": "P4", "dayNo": "34", "beat": "MUDDLE WEDNESDAY", "x": "Yesterday's cartoon — caption this", "video": "", "ig": "Feed: cartoon + reveal thread", "facebook": "Cartoon post", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "Muddle cartoon bank"},
  {"date": "2026-11-19", "dow": "Thu", "phase": "P4", "dayNo": "35", "beat": "WOTD + Hubbub pangram tease", "x": "WOTD quiz + pangram tease", "video": "Pocket games spotlight — RPS / Tic-Tac-Tile for the table", "ig": "", "facebook": "", "pinterest": "Schedule 3 pins", "community": "Batch capture day (Brian)", "cta": "bio link (channel tag)", "asset": "WOTD card / Hubbub"},
  {"date": "2026-11-20", "dow": "Fri", "phase": "P4", "dayNo": "36", "beat": "FRIDAY'S FINEST — best board", "x": "Best board/streak of the week", "video": "18 Days episode ships", "ig": "Feed: Friday's Finest", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "bio link (channel tag)", "asset": "share cards"},
  {"date": "2026-11-21", "dow": "Sat", "phase": "P4", "dayNo": "37", "beat": "Cast Saturday — Thanksgiving costumes", "x": "Cast post", "video": "Family smack-talk skit (founder family cameo optional)", "ig": "Story: cast", "facebook": "", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "cast art"},
  {"date": "2026-11-22", "dow": "Sun", "phase": "P4", "dayNo": "38", "beat": "SWEEP SUNDAY — sweep all 18", "x": "Sweep board + challenge", "video": "", "ig": "Story: sweep board", "facebook": "Sweep post", "pinterest": "", "community": "Replies only", "cta": "bio link (channel tag)", "asset": "sweep share card"},
  {"date": "2026-11-23", "dow": "Mon", "phase": "P4", "dayNo": "39", "beat": "MONDAY MASTERS — race reset", "x": "Race-reset post + last week champion", "video": "", "ig": "Story: race reset", "facebook": "", "pinterest": "", "community": "Monday review: fill KPI tab", "cta": "bio link (channel tag)", "asset": "mon-masters title art"},
  {"date": "2026-11-24", "dow": "Tue", "phase": "P4", "dayNo": "40", "beat": "WOTD quiz day", "x": "Final family-league call + gift-a-shield post", "video": "18 Days episode ships", "ig": "", "facebook": "Crosspost video", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "storeShot capture"},
  {"date": "2026-11-25", "dow": "Wed", "phase": "P4", "dayNo": "41", "beat": "THANKSGIVING EVE themed puzzles", "x": "Themed boards", "video": "", "ig": "Story: travel-day puzzles", "facebook": "Cartoon post", "pinterest": "", "community": "", "cta": "bio link (channel tag)", "asset": "Muddle cartoon bank"},
  {"date": "2026-11-26", "dow": "Thu", "phase": "P4", "dayNo": "42", "beat": "THANKSGIVING — themed puzzles, biggest family day", "x": "\"Loser does the dishes.\" + themed board", "video": "Thanksgiving-table clip", "ig": "", "facebook": "Family post", "pinterest": "Schedule 3 pins", "community": "Batch capture day (Brian)", "cta": "bio link (channel tag)", "asset": "holiday title art"},
  {"date": "2026-11-27", "dow": "Fri", "phase": "P4", "dayNo": "43", "beat": "Annual Pro positioning ($59.99 = $5/mo, 18 games)", "x": "Value post — message only, no discount", "video": "18 Days episode ships", "ig": "Feed: Pro value card", "facebook": "Crosspost", "pinterest": "", "community": "Press follow-ups as needed", "cta": "/pro w/ tag", "asset": "share cards"},
  {"date": "2026-11-28", "dow": "Sat", "phase": "P4", "dayNo": "44", "beat": "45-day wrap prep", "x": "Cast post", "video": "Cast-led video ships", "ig": "Story: cast", "facebook": "", "pinterest": "", "community": "Pull full KPI actuals", "cta": "bio link (channel tag)", "asset": "cast art"},
  {"date": "2026-11-29", "dow": "Sun", "phase": "P4", "dayNo": "45", "beat": "DAY 45 — wrap: 45 days in numbers + December preview", "x": "Wrap thread", "video": "", "ig": "Feed: wrap card", "facebook": "Sweep post", "pinterest": "", "community": "Write 45-day report; re-base next 45", "cta": "bio link (channel tag)", "asset": "sweep share card"},
];

const BY_DATE = new Map(PLAN_DAYS.map((d) => [d.date, d]));

/** JP's plan for one calendar day, or null outside Oct 13 to Nov 29. */
export function planDay(date: string): PlanDay | null {
  return BY_DATE.get(date) ?? null;
}

export function planPhase(id: PlanPhaseId): PlanPhase {
  return PLAN_PHASES.find((p) => p.id === id)!;
}

/** Video days need a screen capture from Brian. */
export function needsCapture(day: PlanDay): boolean {
  return day.video.trim() !== '';
}

export function dayLabel(day: PlanDay): string {
  return day.dayNo.startsWith('D') ? day.dayNo : `Day ${day.dayNo}`;
}
