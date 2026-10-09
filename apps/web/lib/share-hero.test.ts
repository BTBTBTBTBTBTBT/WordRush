import { describe, expect, it } from 'vitest';
import { SHARE_FRAMES, SHARE_HERO_GAP, SHARE_HERO_H, shareHeroBand } from '@wordle-duel/core';
import { planShareCard, shareFixedHeight } from './share-fit';
import { buildLevelUpShareInput, buildPocketResultShareInput, buildStreakShareInput } from './moment-share';
import { shareHeroResultOf, shareCardPlan, type ShareImageInput } from './share-image';

const SINGLE = (won: boolean): ShareImageInput => ({
  layout: 'single', mode: 'Classic', won, timeSeconds: 61, guesses: 3, maxGuesses: 6,
  grid: [['CORRECT', 'CORRECT', 'CORRECT', 'CORRECT', 'CORRECT']],
});

describe('share hero band in the card plan (item 46)', () => {
  const spec = { titleH: 200, headH: 44, footH: 136 };

  it('the band adds its height to the fixed stack and sits right under the title', () => {
    const band = shareHeroBand('message', true);
    expect(band).toBe(SHARE_HERO_H + SHARE_HERO_GAP);
    expect(shareFixedHeight({ ...spec, heroH: band })).toBe(shareFixedHeight(spec) + band);
    const plan = planShareCard({ ...spec, heroH: band }, () => 600);
    expect(plan.heroTop).toBe(plan.titleTop + spec.titleH);
    expect(plan.headTop).toBeGreaterThanOrEqual(plan.heroTop + band);
  });

  it('a card without a hero (a guest) keeps the old geometry exactly', () => {
    const a = planShareCard(spec, () => 600);
    const b = planShareCard({ ...spec, heroH: 0 }, () => 600);
    expect(b.height).toBe(a.height);
    expect(b.boardTop).toBe(a.boardTop);
  });

  it('the story frame is exactly 9:16 and never overflows', () => {
    const plan = planShareCard({ ...spec, heroH: shareHeroBand('story', true), frame: 'story' }, () => 700);
    expect(plan.height).toBe(SHARE_FRAMES.story.maxH);
    expect(plan.boardTop + plan.boardH).toBeLessThanOrEqual(plan.height);
    const tall = planShareCard({ ...spec, heroH: shareHeroBand('story', true), frame: 'story' }, (maxH) => Math.min(3000, maxH));
    expect(tall.height).toBe(1920);
    expect(tall.contentH).toBeLessThanOrEqual(1920 - shareFixedHeight({ ...spec, heroH: shareHeroBand('story', true) }));
  });

  it('shareCardPlan threads the band through for a real input', () => {
    const none = shareCardPlan(SINGLE(true), null);
    const hero = shareCardPlan(SINGLE(true), null, { heroH: shareHeroBand('message', true) });
    expect(hero.plan.heroTop).toBe(none.plan.titleTop + none.titleH);
    expect(hero.plan.boardTop).toBeGreaterThan(none.plan.boardTop - 1);
  });
});

describe('what each share celebrates', () => {
  it('results by win, sweeps by flawless', () => {
    expect(shareHeroResultOf(SINGLE(true))).toBe('win');
    expect(shareHeroResultOf(SINGLE(false))).toBe('loss');
  });
  it('moment builders write complete lines and the right hero', () => {
    const lvl = buildLevelUpShareInput({ level: 12, tierLabel: 'Silver', xpToNext: 340 });
    expect(lvl.big).toBe('12');
    expect(lvl.lines).toEqual(['Silver tier', '340 XP to level 13']);
    expect(shareHeroResultOf(lvl)).toBe('win');

    const won = buildPocketResultShareInput({ gameTitle: 'Rock Paper Scissors', won: true, mine: 2, theirs: 1, opponent: 'Ava' });
    expect(won.title).toBe('ROCK PAPER SCISSORS');
    expect(won.big).toBe('2–1');
    expect(won.lines[0]).toBe('I beat Ava');
    expect(shareHeroResultOf(won)).toBe('win');
    const lost = buildPocketResultShareInput({ gameTitle: 'Ghost', won: false, mine: 0, theirs: 2, opponent: 'Ava' });
    expect(lost.lines[0]).toBe('Good game, Ava');
    expect(shareHeroResultOf(lost)).toBe('loss');

    const streak = buildStreakShareInput({ streak: 7, best: 7, lastDays: [true, true, false, true, true, true, true, true] });
    expect(streak.dots).toHaveLength(7);
    expect(streak.lines).toContain('A new personal best');
    expect(shareHeroResultOf(streak)).toBe('flawless');
  });
});
