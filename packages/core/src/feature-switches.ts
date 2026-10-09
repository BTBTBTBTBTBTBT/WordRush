// ============================================================
// 2.8 off-switches (FRIDAY-QUEUE item 38)
// ============================================================
// Every big new 2.8 feature has a row in public.app_flags so the founder can turn it
// off from admin > Ops > Feature flags in minutes, without a build. Unlike the More
// Games gates (fail CLOSED, flags.ts isFlagOn), these fail OPEN: the feature is ON
// unless its row exists and says otherwise —
//
//   flags unknown / unreachable → on   (an outage never turns features off)
//   no row for the key          → on
//   row.enabled = false         → OFF  (the off-switch)
//   row.audience = 'testers'    → on for admins/testers only (a staged re-enable)
//   row.audience = 'all'        → on
//
// Mirrors: FlagsService.isLive (Swift), FlagsService.isLive (Kotlin), isFeatureLive (web).

export const FEATURE_SWITCHES = {
  live_play: 'Live pocket-game play (realtime moves + presence)',
  branded_invites: 'Branded one-link invites + preview images',
  mascot_voices: 'Mascot voices + mood babble',
  speech_bubbles: 'Home notifications as cast speech bubbles',
  living_mascot: 'Living (rigged) mascots everywhere',
  living_wallpapers: 'Ambient wallpaper motion (drifting tiles, bats, witch)',
  rich_push: 'New push formats (mascot avatars, game art, grouping)',
  age_check: '13+ age check at sign-up / launch',
  season_halloween: 'The Halloween season (off = normal look everywhere)',
  opening_animation_season: 'Seasonal costumed opening animation',
  musical_cast: 'Musical cast easter egg + seasonal tunes',
  first_play_tutorials: 'First-play welcome tutorials',
  whats_new_28: 'One-time "What\'s new in 2.8" tour',
  custom_game_order: 'Player-reorderable game lists',
  pro_try_on: 'Pro item try-on + unlock popup',
  header_condense: 'Cast header slims as the page scrolls (the soft fade under it always stays)',
  bubble_atlas: 'Bubble-letter glyph atlas for changing headlines (off = the live headline font)',
} as const;

export type FeatureSwitch = keyof typeof FEATURE_SWITCHES;
export const FEATURE_SWITCH_KEYS = Object.keys(FEATURE_SWITCHES) as FeatureSwitch[];

export interface SwitchRow {
  enabled: boolean;
  audience: string;
}

/** Fail-open resolver for the 2.8 off-switches (see header). */
export function isFeatureLive(
  key: FeatureSwitch | string,
  flags: Record<string, SwitchRow> | null | undefined,
  isTester: boolean,
): boolean {
  if (!flags) return true;
  const row = flags[key];
  if (!row) return true;
  if (!row.enabled) return false;
  if (row.audience === 'all') return true;
  return isTester;
}
