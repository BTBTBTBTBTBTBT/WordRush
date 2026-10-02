import { describe, expect, it } from 'vitest';
import { codeFromInviteUrl, codeTiles, giftShareText, giftsLeft, inviteShareText, parseWatched, trackRequests } from './invite-screens';

describe('codeTiles', () => {
  it('splits a code into uppercase letter/digit tiles', () => {
    expect(codeTiles('ab-12 cd')).toEqual(['A', 'B', '1', '2', 'C', 'D']);
    expect(codeTiles(null)).toEqual([]);
  });
});

describe('codeFromInviteUrl', () => {
  it('reads the code at the end of a join link', () => {
    expect(codeFromInviteUrl('https://wordocious.com/vs/join/ab12cd')).toBe('AB12CD');
    expect(codeFromInviteUrl('https://wordocious.com/join/XYZ9/')).toBe('XYZ9');
    expect(codeFromInviteUrl('https://wordocious.com/join/XYZ9?x=1')).toBe('XYZ9');
    expect(codeFromInviteUrl('https://wordocious.com/profile/1')).toBeNull();
    expect(codeFromInviteUrl(undefined)).toBeNull();
  });
});

describe('giftsLeft', () => {
  it('counts free slots, clamped', () => {
    expect(giftsLeft(0)).toBe(3);
    expect(giftsLeft(2)).toBe(1);
    expect(giftsLeft(5)).toBe(0);
    expect(giftsLeft(-1)).toBe(3);
  });
});

describe('invite share text', () => {
  const url = 'https://wordocious.com/join/AB12CD';
  const now = new Date('2026-10-02T12:00:00Z');
  it('uses the shared invite line without the link', () => {
    const t = inviteShareText(url, now);
    expect(t).toContain('Wordocious');
    expect(t).not.toContain(url);
  });
  it('adds the gift line for gift invites', () => {
    const t = giftShareText(url, now);
    expect(t.startsWith(inviteShareText(url, now))).toBe(true);
    expect(t).toContain('7 days of Wordocious Pro');
    expect(t).not.toContain(url);
  });
});

describe('trackRequests', () => {
  it('starts watching every outgoing request', () => {
    expect(trackRequests([], ['a', 'b'], [])).toEqual({ accepted: [], watch: ['a', 'b'] });
  });
  it('celebrates a watched request that became a friend, once', () => {
    const r = trackRequests(['a', 'b'], ['b'], ['A']);
    expect(r).toEqual({ accepted: ['a'], watch: ['b'] });
    expect(trackRequests(r.watch, ['b'], ['A'])).toEqual({ accepted: [], watch: ['b'] });
  });
  it('drops declined or canceled requests without celebrating', () => {
    expect(trackRequests(['a'], [], [])).toEqual({ accepted: [], watch: [] });
  });
  it('never celebrates a friend it was not watching', () => {
    expect(trackRequests([], [], ['z'])).toEqual({ accepted: [], watch: [] });
  });
});

describe('parseWatched', () => {
  it('reads a stored list and ignores junk', () => {
    expect(parseWatched('["a","b"]')).toEqual(['a', 'b']);
    expect(parseWatched('[1,"a",""]')).toEqual(['a']);
    expect(parseWatched('{')).toEqual([]);
    expect(parseWatched(null)).toEqual([]);
  });
});
