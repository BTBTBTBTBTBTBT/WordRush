import { describe, expect, it } from 'vitest';
import {
  cleanInviteCode, inviteHeadline, inviteShareLine, inviteSubline, inviteUrl, isVsCode, parseInvitePath, parseTypedInvite, raceLine,
} from './branded-invite';

describe('invite codes + urls', () => {
  it('cleans and validates', () => {
    expect(cleanInviteCode(' ant5-ttzr ')).toBe('ANT5TTZR');
    expect(isVsCode('ANT5TTZR')).toBe(true);
    expect(isVsCode('ANT5TTZ')).toBe(false);
    expect(isVsCode('ANT5TT0R')).toBe(false); // 0 is not in the alphabet
    expect(inviteUrl('vs', 'ant5ttzr')).toBe('https://wordocious.com/vs/ANT5TTZR');
    expect(inviteUrl('friend', 'abc234')).toBe('https://wordocious.com/friend/ABC234');
  });

  it('parses the one-link form and the old forms', () => {
    expect(parseInvitePath('https://wordocious.com/vs/ANT5TTZR')).toEqual({ kind: 'vs', code: 'ANT5TTZR' });
    expect(parseInvitePath('https://www.wordocious.com/vs/join/ant5ttzr?x=1')).toEqual({ kind: 'vs', code: 'ANT5TTZR' });
    expect(parseInvitePath('/vs/challenge/ANT5TTZR/')).toEqual({ kind: 'vs', code: 'ANT5TTZR' });
    expect(parseInvitePath('https://wordocious.com/friend/ABC234')).toEqual({ kind: 'friend', code: 'ABC234' });
    expect(parseInvitePath('https://wordocious.com/join/ABC234')).toEqual({ kind: 'friend', code: 'ABC234' });
  });

  it('never mistakes the static /vs pages for a code', () => {
    for (const p of ['/vs/bots', '/vs/live', '/vs/friend', '/vs/join', '/vs/challenge']) expect(parseInvitePath(p)).toBeNull();
    expect(parseInvitePath('https://example.com/vs/ANT5TTZR')).toBeNull();
  });

  it('"Have a code?" takes a bare code or a link', () => {
    expect(parseTypedInvite('ant5 ttzr')).toEqual({ kind: 'vs', code: 'ANT5TTZR' });
    expect(parseTypedInvite('https://wordocious.com/vs/ANT5TTZR')).toEqual({ kind: 'vs', code: 'ANT5TTZR' });
    expect(parseTypedInvite('hello')).toBeNull();
  });
});

describe('preview copy', () => {
  it('reads like the founder asked', () => {
    expect(inviteHeadline({ variant: 'live', sender: 'Johnny', game: 'Classic' })).toBe('Johnny challenges you to CLASSIC');
    expect(inviteShareLine({ variant: 'live', sender: 'Johnny', game: 'Classic' })).toBe('Johnny wants to race you in Classic');
    expect(inviteSubline({ variant: 'race', sender: 'Johnny', game: 'Classic', raceLine: raceLine({ solved: true, guesses: 4, timeMs: 72_000 }) }))
      .toBe('Beat their run: solved in 4 · 1:12');
    expect(raceLine({ solved: false, guesses: 6, timeMs: 1000 })).toBe('a run to beat');
    expect(inviteHeadline({ variant: 'friend', sender: 'Doug' })).toBe('Doug invited you to Wordocious');
  });
});
