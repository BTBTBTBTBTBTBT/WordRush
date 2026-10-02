import { describe, expect, it } from 'vitest';
import { BOT_CAST_PERSONAS, BOT_PERSONAS, botArt, botLine, botOfDayPersona, botPersona, botRosterEntry, type BotEvent } from './bot-personas';
import { botIdForKind, castBotForKind, cpuIdentity, engineDifficultyForKind, guessRangeForKind, parseCpuKind } from '@/lib/adapters/bot-match-service';

describe('the bot cast personas (FINISH_SPEC D1)', () => {
  it('draws each bot as its own character', () => {
    expect(BOT_CAST_PERSONAS.webster.avatar).toBe('/art/art-pose-w-ready.webp');
    expect(botArt('scoot', 'victory')).toBe('/art/art-pose-s-victory.webp');
    expect(botArt('nova', 'goodgame')).toBe('/art/art-pose-d-goodgame.webp'); // old id → Dewey
    expect(botArt('ghost')).toBe('/vs/bots/ghost.png');
  });
  it('keeps the old tier slots on the mapped bots', () => {
    expect([BOT_PERSONAS.easy.id, BOT_PERSONAS.medium.id, BOT_PERSONAS.hard.id]).toEqual(['ivy', 'opal', 'dewey']);
    expect(botPersona('adapt').difficulty).toBe('adaptive');
    expect(botPersona('unknown').id).toBe('opal');
  });
  it('roster lines', () => {
    expect(botRosterEntry('rip')).toEqual({ id: 'rip', name: 'Rip', tier: 'Easy', line: 'Solves in 6' });
    expect(botRosterEntry('umi')).toMatchObject({ tier: 'Adaptive', line: 'Matches your form' });
    expect(botRosterEntry('ghost').name).toBe('Your Ghost');
  });
  it('has kind banter for every bot and event', () => {
    const events: BotEvent[] = ['match_start', 'bot_solved_board', 'player_overtakes', 'player_near_miss', 'bot_win', 'bot_loss'];
    for (const id of Object.keys(BOT_CAST_PERSONAS)) for (const e of events) expect(botLine(id, e), `${id} ${e}`).toBeTruthy();
    expect(botLine('lexi', 'bot_win')).toBeTruthy();
    expect(botLine('ghost', 'bot_win')).toBeNull();
  });
  it('Bot of the Day follows the day host', () => {
    expect(botOfDayPersona('2026-10-05').name).toBe('Dewey'); // Monday
    expect(botOfDayPersona('2026-10-10').name).toBe('Ollie'); // Saturday
  });
});

describe('cpu kinds', () => {
  it('parses cast ids, old ids and old tier kinds', () => {
    expect(parseCpuKind('scoot')).toBe('scoot');
    expect(parseCpuKind('lexi')).toBe('opal');
    expect(parseCpuKind('hard')).toBe('hard');
    expect(parseCpuKind('daily')).toBe('daily');
    expect(parseCpuKind('bogus')).toBeNull();
    expect(parseCpuKind(null)).toBeNull();
  });
  it('maps kinds to the cast', () => {
    expect(castBotForKind('easy')).toBe('ivy');
    expect(castBotForKind('adaptive')).toBe('umi');
    expect(castBotForKind('daily', '2026-10-07')).toBe('umi'); // Wednesday
    expect(castBotForKind('ghost')).toBeNull();
    expect(botIdForKind('hard')).toBe('dewey');
    expect(botIdForKind('daily')).toBe('daily');
    expect(engineDifficultyForKind('umi')).toBe('adaptive');
    expect(engineDifficultyForKind('webster')).toBe('hard');
    expect(guessRangeForKind('webster')).toEqual([2, 3]);
    expect(guessRangeForKind('umi')).toBeNull();
    expect(cpuIdentity('cpu:cosmo')).toMatchObject({ name: 'Cosmo', castId: 'c', tier: 'medium', botId: 'cosmo' });
    expect(cpuIdentity('cpu:medium').name).toBe('Opal');
    expect(cpuIdentity('cpu:ghost').name).toBe('Your Ghost');
  });
});
