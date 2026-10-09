// The screens / states the season contrast sweep (e2e/season-contrast.test.ts) renders. Each is a
// route plus, optionally, who is looking (a guest, a signed-in player with an empty account, or a
// first visit), storage to seed, and an `act` that opens the state (a popup, a finish screen …).
// Add a screen here when one ships; every season in the registry is swept over all of them.
import type { Page } from 'playwright-core';

export interface Screen {
  id: string;
  path: string;
  /** 'guest' (default) | 'user' (a signed-in, empty account; Supabase is faked) | 'new' (first visit). */
  as?: 'guest' | 'user' | 'new';
  storage?: Record<string, string>;
  settle?: number;
  act?: (page: Page) => Promise<void>;
}

/** Click the first visible element matching `selector` (role/text locators allowed); throws when missing. */
async function tap(page: Page, selector: string, settle = 900): Promise<void> {
  const el = page.locator(selector).locator('visible=true').first();
  await el.click({ timeout: 10_000 });
  await page.waitForTimeout(settle);
}

/** Type whole-word guesses on the game keyboard (physical keys) and submit each. */
async function guess(page: Page, words: string[]): Promise<void> {
  for (const w of words) {
    for (const ch of w) await page.keyboard.press(ch);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(700);
  }
}

/** Lose a fixed-length word game: wrong-but-valid guesses until the board runs out (→ finish screen). */
function loseWith(words: string[]): (page: Page) => Promise<void> {
  return async (page) => {
    await page.locator('body').click({ position: { x: 5, y: 400 } }).catch(() => {});
    await guess(page, words);
    await page.waitForTimeout(3500);
  };
}

const FIVES = ['CRANE', 'SLOTH', 'PUDGY', 'WIMPS', 'FJORD', 'BLOCK', 'THUMB', 'GLYPH', 'VIXEN'];
const SIXES = ['PLANET', 'GROUND', 'FLIGHT', 'MOTHER', 'BASKET', 'WINDOW', 'JUNGLE'];
const SEVENS = ['PICTURE', 'BALANCE', 'CHAPTER', 'DOLPHIN', 'FREIGHT', 'JOURNEY', 'MONSTER', 'QUALIFY'];

export const SCREENS: Screen[] = [
  // ── Home + first run ──
  { id: 'welcome', path: '/', as: 'new' },
  { id: 'home', path: '/' },
  { id: 'home-signed-in', path: '/', as: 'user' },
  { id: 'home-puzzles', path: '/?more=1' },
  { id: 'menu-popup', path: '/', act: (p) => tap(p, 'button[aria-label="Menu"]') },
  { id: 'settings-popup', path: '/', as: 'user', act: (p) => tap(p, 'button[aria-label="Settings"]') },
  { id: 'season-nudge', path: '/?dressDemo=nudge' },

  // ── Tabs ──
  { id: 'leaderboard', path: '/daily', as: 'user' },
  { id: 'leaderboard-guest', path: '/daily' },
  { id: 'records', path: '/records', as: 'user' },
  { id: 'stats', path: '/stats', as: 'user' },
  { id: 'stats-guest', path: '/stats' },
  { id: 'friends', path: '/friends', as: 'user' },
  { id: 'friends-guest', path: '/friends' },

  // ── Profile: Edit Profile / Stage / Dressing Room ──
  { id: 'profile', path: '/profile', as: 'user' },
  { id: 'stage', path: `/stats?dress=${encodeURIComponent(JSON.stringify({ kind: 'stage' }))}`, as: 'user', settle: 2000 },
  { id: 'dressing-room', path: '/?dressDemo=room-head', settle: 2000 },
  { id: 'dressing-room-season', path: '/?dressDemo=room-season', settle: 2000 },

  // ── Paywall ──
  { id: 'paywall', path: '/pro', as: 'user' },
  { id: 'pro-perk-gate', path: '/practice' },
  { id: 'paywall-guest', path: '/pro' },

  // ── VS ──
  { id: 'vs-lobby', path: '/vs', as: 'user' },
  { id: 'vs-bots', path: '/vs/bots', as: 'user' },
  { id: 'vs-friend', path: '/vs/friend', as: 'user' },
  { id: 'vs-game', path: '/practice/vs?daily=true', as: 'user', settle: 2500 },

  // ── Games (board) + finish screens (lost on purpose) ──
  { id: 'classic', path: '/practice?daily=true' },
  { id: 'classic-finish', path: '/practice?daily=true', act: loseWith(FIVES.slice(0, 6)) },
  { id: 'six', path: '/six?daily=true' },
  { id: 'six-finish', path: '/six?daily=true', act: loseWith(SIXES) },
  { id: 'seven', path: '/seven?daily=true' },
  { id: 'seven-finish', path: '/seven?daily=true', act: loseWith(SEVENS) },
  { id: 'quadword', path: '/quadword?daily=true' },
  { id: 'quadword-finish', path: '/quadword?daily=true', act: loseWith(FIVES) },
  { id: 'octoword', path: '/octoword?daily=true' },
  { id: 'sequence', path: '/sequence?daily=true' },
  { id: 'rescue', path: '/rescue?daily=true' },
  { id: 'gauntlet', path: '/gauntlet?daily=true' },
  { id: 'propernoundle', path: '/propernoundle?daily=true' },
  { id: 'codebreaker', path: '/codebreaker?daily=true' },
  { id: 'crosswordocious', path: '/crosswordocious?daily=true' },
  { id: 'hubbub', path: '/hubbub?daily=true' },
  { id: 'kindred', path: '/kindred?daily=true' },
  { id: 'letter-ladder', path: '/letter-ladder?daily=true' },
  { id: 'muddle', path: '/muddle?daily=true' },
  { id: 'spyglass', path: '/spyglass?daily=true' },
  { id: 'starsweep', path: '/starsweep?daily=true' },
  { id: 'sudocious', path: '/sudocious?daily=true' },
  { id: 'how-to-play-popup', path: '/practice?daily=true', act: (p) => tap(p, 'button[aria-label="How to play"]') },

  // ── Content pages ──
  { id: 'word-of-the-day', path: '/words' },
  { id: 'how-to-play', path: '/how-to-play' },
  { id: 'faq', path: '/faq' },
];
