// ============================================================
// Leaderboard stage (FRIDAY-QUEUE items 11 + 11b)
// ============================================================
// The Leaderboard top is ONE living stage: the day's title in bubble lettering with the player's
// mascot and the day's cast host beside it, the game picker in the same card, the selected-game strip,
// then the podium on a continuous backdrop, with Yesterday's winners as the stage's base ledge.
// This file holds the shared constants so web, iOS and Android agree (pinned by tests ×3).

export interface StageHost {
  /** The cast member that hosts the day (pose art `art-pose-<castId>-<pose>`). W is never a host (W stays the player's/Home's). */
  castId: string;
  pose: string;
}

/** Sunday … Saturday. Wednesday is U the wizard (WEDNESDAY WIZARDS); poses all exist as shipped art. */
export const DAY_HOSTS: readonly StageHost[] = [
  { castId: 's', pose: 'trophy' },   // SUNDAY SUPERSTARS
  { castId: 'd', pose: 'lean' },     // MONDAY MASTERS
  { castId: 'c', pose: 'lean' },     // TUESDAY TITANS
  { castId: 'u', pose: 'spin' },     // WEDNESDAY WIZARDS
  { castId: 'r', pose: 'lean' },     // THURSDAY THUNDER
  { castId: 'i', pose: 'lean' },     // FRIDAY'S FINEST
  { castId: 's', pose: 'flex' },     // SATURDAY STARS
];

/** How a weekday's prop moves beside the title (each weekday its own little motion; Reduce Motion = still). */
export type DayMotion = 'spin' | 'bob' | 'hover' | 'swish' | 'flash' | 'drift';

export interface DayProp {
  /** Art name (`art-lb-day-<key>`, art/driver docs/design/brand/2.8/leaderboard/out). */
  art: string;
  motion: DayMotion;
}

/** Sunday … Saturday. Wednesday's wand swishes (WEDNESDAY WIZARDS); Thursday's lightning flashes. */
export const DAY_PROPS: readonly DayProp[] = [
  { art: 'art-lb-day-sun', motion: 'spin' },              // SUNDAY SUPERSTARS
  { art: 'art-lb-day-coffee', motion: 'bob' },             // MONDAY MASTERS
  { art: 'art-lb-day-rocket', motion: 'hover' },           // TUESDAY TITANS
  { art: 'art-lb-day-wand-swish', motion: 'swish' },       // WEDNESDAY WIZARDS
  { art: 'art-lb-day-lightning', motion: 'flash' },        // THURSDAY THUNDER
  { art: 'art-lb-day-rainbow-cloud', motion: 'drift' },    // FRIDAY'S FINEST
  { art: 'art-lb-day-sun', motion: 'spin' },               // SATURDAY STARS
];

export function dayProp(day: string): DayProp {
  return DAY_PROPS[stageWeekday(day)];
}

/** Wizard Wednesday: your mascot wears the wizard hat on this page, for the day only (display-only, never saved). */
export const WIZARD_HAT_PART = 'wizard';
export function wearsWizardHat(day: string): boolean {
  return stageWeekday(day) === 3;
}

/** The title lean: your mascot leans toward the title by this many degrees (base fixed). */
export const MASCOT_LEAN_DEGREES = 7;

/** 0 = Sunday … 6 = Saturday, for the player's local YYYY-MM-DD. */
export function stageWeekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The day's cast host. */
export function dayHost(day: string): StageHost {
  return DAY_HOSTS[stageWeekday(day)];
}

/**
 * The continuous backdrop's layers, top to bottom, as alphas of the SELECTED GAME'S accent over the page
 * wallpaper: the sky wash behind the title and picker, the sunburst behind the podium, the floor glow
 * under it. One tint flows through all of them (a game switch sweeps all three together).
 */
export const STAGE_TINT = {
  skyTop: 0.26,
  skyMid: 0.14,
  skyBottom: 0.0,
  /** The sunburst light art's opacity (it is white; the tint comes from the sky under it). */
  rays: 0.7,
  floorGlow: 0.3,
} as const;

/** The podium must be fully visible on a standard phone: the stage above it stays within this height (pt / px / dp). */
export const STAGE_TOP_MAX_HEIGHT = 330;
/** The standard phone's usable height under the app header and above the tab bar (iPhone 15). */
export const STANDARD_PHONE_USABLE_HEIGHT = 650;
/** The podium block's own height (mascots + steps + floor). */
export const PODIUM_BLOCK_HEIGHT = 250;

/** The mini steps on the Yesterday ledge art (394 x 160): place 2 left, 1 centre, 3 right; x = fraction of the art width, h = step top as a fraction of the height. */
export const LEDGE_STEPS = [
  { place: 2, x: 0.215, top: 0.5 },
  { place: 1, x: 0.5, top: 0.36 },
  { place: 3, x: 0.785, top: 0.58 },
] as const;

/** Mini mascot size on the ledge, as a fraction of the art's width. */
export const LEDGE_FIGURE_FRACTION = 0.2;

/** The sunburst + clouds + floor disc + ledge + compact "Your board" pill art ids (web names; iOS/Android: same, underscores on Android). */
export const STAGE_ART = {
  clouds: 'art-lb-clouds',
  floorDisc: 'art-lb-floor-disc',
  ledge: 'art-lb-ledge',
  sunburst: 'art-lb-sunburst',
  yourBoard: 'art-lb-btn-yourboard',
} as const;

/** Does the stage top + podium fit a phone's usable height? (the 11b rule: all three mascots visible without scrolling) */
export function podiumFits(stageTopHeight: number, usable = STANDARD_PHONE_USABLE_HEIGHT): boolean {
  return stageTopHeight + PODIUM_BLOCK_HEIGHT <= usable;
}
