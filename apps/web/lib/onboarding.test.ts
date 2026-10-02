import { describe, expect, it } from 'vitest';
import { validateUsername } from '@wordle-duel/core';
import { escapeLike, hasPlayedLocally, ONBOARDED_KEY, onboardingDecision, profileHasPlayed, TOUR_HREF, usernameSuggestions } from './onboarding';

const base = {
  tour: false,
  onboarded: false,
  playedLocally: false,
  authLoading: false,
  signedIn: false,
  profile: null,
  pathname: '/',
  introRunning: false,
};

describe('hasPlayedLocally', () => {
  it('finds the keys games write', () => {
    expect(hasPlayedLocally(['wordle-duel-stats-DUEL'])).toBe(true);
    expect(hasPlayedLocally(['wordocious-session-DUEL-daily'])).toBe(true);
    expect(hasPlayedLocally(['wordocious-plays-anon-2026-10-02'])).toBe(true);
    expect(hasPlayedLocally(['wordocious-sudoku-daily'])).toBe(true);
    expect(hasPlayedLocally(['wordocious-propernoundle-practice'])).toBe(true);
    expect(hasPlayedLocally(['gauntlet-stats'])).toBe(true);
  });
  it('ignores prefs, caches and flags', () => {
    expect(hasPlayedLocally([])).toBe(false);
    expect(hasPlayedLocally([
      'wordle-duel-theme', 'wordocious-sound-enabled', 'pref-haptics', 'wordocious-guest',
      'wordocious-active-uid', 'wordocious-app-flags', 'wordocious-profile-cache', 'onboarded-v1',
      'wordocious-dismissed-announcements', 'wordocious-storage-migrated-v1', 'wordocious-anon-presence-id',
    ])).toBe(false);
  });
});

describe('profileHasPlayed', () => {
  it('reads wins, losses, xp or a last-played date', () => {
    expect(profileHasPlayed(null)).toBe(false);
    expect(profileHasPlayed({ total_wins: 0, total_losses: 0, xp: 0, last_played_at: null })).toBe(false);
    expect(profileHasPlayed({ total_wins: 1 })).toBe(true);
    expect(profileHasPlayed({ total_losses: 2 })).toBe(true);
    expect(profileHasPlayed({ xp: 40 })).toBe(true);
    expect(profileHasPlayed({ last_played_at: '2026-10-01T10:00:00Z' })).toBe(true);
  });
});

describe('onboardingDecision', () => {
  it('shows a brand-new guest at Home', () => {
    expect(onboardingDecision(base)).toBe('show');
  });
  it('waits for the cold-start intro', () => {
    expect(onboardingDecision({ ...base, introRunning: true })).toBe('wait');
  });
  it('never shows twice', () => {
    expect(onboardingDecision({ ...base, onboarded: true })).toBe('skip');
  });
  it('marks existing players silently (local play)', () => {
    expect(onboardingDecision({ ...base, playedLocally: true })).toBe('mark');
    expect(onboardingDecision({ ...base, playedLocally: true, pathname: '/practice' })).toBe('mark');
  });
  it('marks signed-in players with games', () => {
    expect(onboardingDecision({ ...base, signedIn: true, profile: { total_wins: 12 } })).toBe('mark');
  });
  it('shows a signed-in player with an empty profile', () => {
    expect(onboardingDecision({ ...base, signedIn: true, profile: { total_wins: 0, total_losses: 0, xp: 0, last_played_at: null } })).toBe('show');
  });
  it('waits while auth or the profile loads', () => {
    expect(onboardingDecision({ ...base, authLoading: true })).toBe('wait');
    expect(onboardingDecision({ ...base, signedIn: true, profile: null })).toBe('wait');
  });
  it('first run only at Home', () => {
    expect(onboardingDecision({ ...base, pathname: '/practice' })).toBe('skip');
  });
  it('replays on request, even for onboarded players', () => {
    expect(onboardingDecision({ ...base, tour: true, onboarded: true, playedLocally: true })).toBe('show');
    expect(onboardingDecision({ ...base, tour: true, introRunning: true })).toBe('wait');
  });
  it('marks players who saw the old tour (onboarded-v1)', () => {
    expect(ONBOARDED_KEY).toBe('onboarded-v2');
    expect(onboardingDecision({ ...base, legacyOnboarded: true })).toBe('mark');
    expect(onboardingDecision({ ...base, legacyOnboarded: true, tour: true })).toBe('show');
  });
  it('links the tour from Home', () => {
    expect(TOUR_HREF).toBe('/?tour=1');
  });
});

describe('username step', () => {
  const ok = (n: string) => validateUsername(n).ok;
  it('suggests three valid, distinct names', () => {
    for (const seed of [1, 7, 42, 999]) {
      const s = usernameSuggestions('wordfan', seed, ok);
      expect(s).toHaveLength(3);
      expect(new Set(s.map((x) => x.toLowerCase())).size).toBe(3);
      s.forEach((x) => expect(ok(x)).toBe(true));
      expect(s).not.toContain('wordfan');
    }
  });
  it('copes with an empty or odd base', () => {
    expect(usernameSuggestions('', 3, ok)).toHaveLength(3);
    expect(usernameSuggestions('!!', 3, ok)).toHaveLength(3);
    usernameSuggestions('averyveryverylongusername', 5, ok).forEach((x) => expect(x.length).toBeLessThanOrEqual(20));
  });
  it('escapes LIKE wildcards', () => {
    expect(escapeLike('a_b%c')).toBe('a\\_b\\%c');
    expect(escapeLike('plain')).toBe('plain');
  });
});
