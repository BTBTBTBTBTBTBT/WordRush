import { describe, expect, it } from 'vitest';
import { STRATEGY_ARTICLES } from './strategy-content';
import {
  STRATEGY_GAME_BY_SLUG,
  howToPlayModeId,
  localDayNumber,
  splitTakeaway,
  strategyGameId,
  strategyLooks,
  strategyOrder,
  strategySections,
  tipOfDayIndex,
} from './strategy-games';
import { HOW_TO_PLAY } from './how-to-play-content';

describe('strategy slug → game (parity map)', () => {
  it('maps every shipped article', () => {
    for (const a of STRATEGY_ARTICLES) {
      expect(Object.prototype.hasOwnProperty.call(STRATEGY_GAME_BY_SLUG, a.slug), a.slug).toBe(true);
    }
  });

  it('falls back to the catalog title for an unlisted "-playbook" slug, else general', () => {
    expect(strategyGameId('letter-ladder-playbook')).toBe('ladder');
    expect(strategyGameId('octoword-playbook')).toBe('octordle');
    expect(strategyGameId('succession')).toBe('sequence');
    expect(strategyGameId('something-new')).toBeNull();
  });

  it('gives each article its group, accent, host, art and play button', () => {
    const looks = strategyLooks(STRATEGY_ARTICLES);
    const by = Object.fromEntries(looks.map((l) => [l.slug, l]));
    expect(by['best-starting-words']).toMatchObject({ gameId: 'practice', group: 'dailies', accent: '#7c3aed', host: 'w', titleArt: 'art-game-practice', playHref: '/practice?daily=true', playLabel: 'PLAY CLASSIC' });
    expect(by['sudocious-playbook']).toMatchObject({ group: 'puzzles', host: 'u', playLabel: 'PLAY SUDOCIOUS', playHref: '/sudocious?daily=true' });
    expect(by['vs-battle-tactics']).toMatchObject({ gameId: 'vs', group: 'dailies', host: 'w', titleArt: null, playHref: null, playLabel: null });
    // General articles: brand purple, the cast in WORDOCIOUS order by general index.
    expect(by['modes-explained']).toMatchObject({ gameId: null, group: 'every', accent: '#7c3aed', host: 'w', playHref: null });
    expect(by['daily-sweep-guide'].host).toBe('o1');
    expect(by['letter-frequency-atlas'].host).toBe('r');
    expect(by['repeated-letter-traps'].host).toBe('d');
    expect(by['beginner-to-sweeper'].host).toBe('o2');
  });

  it('orders sections dailies → puzzles → every game, API order within', () => {
    const sections = strategySections(STRATEGY_ARTICLES);
    expect(sections.map((s) => s.label)).toEqual(['WORDOCIOUS DAILIES', 'PUZZLES', 'EVERY GAME']);
    expect(sections[0].items.map((x) => x.article.slug)).toEqual(['best-starting-words', 'solve-faster', 'multi-board-mastery', 'gauntlet-survival', 'vs-battle-tactics']);
    expect(sections[2].items.map((x) => x.article.slug)).toEqual(['modes-explained', 'daily-sweep-guide', 'letter-frequency-atlas', 'repeated-letter-traps', 'beginner-to-sweeper']);
    const flat = strategyOrder(STRATEGY_ARTICLES);
    expect(flat).toHaveLength(STRATEGY_ARTICLES.length);
    expect(flat[5].article.slug).toBe('propernoundle-playbook');
  });
});

describe('tip of the day', () => {
  it('counts whole days to the local calendar date', () => {
    expect(localDayNumber(new Date(1970, 0, 1, 23, 59))).toBe(0);
    expect(localDayNumber(new Date(2026, 9, 2, 0, 1))).toBe(20728);
    expect(localDayNumber(new Date(2026, 9, 2, 23, 59))).toBe(20728);
  });

  it('picks day % count', () => {
    expect(tipOfDayIndex(new Date(2026, 9, 2, 12), 20)).toBe(20728 % 20);
    expect(tipOfDayIndex(new Date(2026, 9, 3, 12), 20)).toBe(20729 % 20);
    expect(tipOfDayIndex(new Date(2026, 9, 2), 0)).toBe(0);
  });
});

describe('takeaway', () => {
  it('splits the first sentence at index ≥ 20', () => {
    expect(splitTakeaway('In a five-letter puzzle, the first row is blind. Every later guess is shaped.')).toEqual({
      takeaway: 'In a five-letter puzzle, the first row is blind.',
      rest: 'Every later guess is shaped.',
    });
    // A short "e.g. " before index 20 is skipped.
    expect(splitTakeaway('Try e.g. SLATE first, then the rest! It works.').takeaway).toBe('Try e.g. SLATE first, then the rest!');
  });

  it('has no takeaway without a split point; an empty remainder is empty', () => {
    expect(splitTakeaway('One sentence with no break at all.')).toEqual({ takeaway: null, rest: 'One sentence with no break at all.' });
    expect(splitTakeaway('Short. Then a long tail without any further stops')).toEqual({ takeaway: null, rest: 'Short. Then a long tail without any further stops' });
    expect(splitTakeaway('Is this sentence long enough? ')).toEqual({ takeaway: 'Is this sentence long enough?', rest: '' });
  });
});

describe('how to play mode icons', () => {
  it('matches the text before " — " to the catalog', () => {
    expect(howToPlayModeId('Classic — 1 Word, 6 Guesses')).toBe('practice');
    expect(howToPlayModeId('VS Battle — Live Matches')).toBe('vs');
    expect(howToPlayModeId('Puzzles — Ten Extra Dailies')).toBe('more');
    expect(howToPlayModeId('Letter Ladder — One Letter at a Time')).toBe('ladder');
    expect(howToPlayModeId('Nothing — at all')).toBeNull();
    const modes = HOW_TO_PLAY.flatMap((s) => s.modes ?? []);
    for (const m of modes) expect(howToPlayModeId(m.name), m.name).not.toBeNull();
  });
});
