import { describe, expect, it } from 'vitest';
import { gamesSubtitle, isNotesMenu } from './friend-card-copy';

describe('gamesSubtitle', () => {
  it('lists up to three games', () => {
    expect(gamesSubtitle(['Ghost', 'Call It'])).toBe('Ghost, Call It');
    expect(gamesSubtitle(['Ghost', 'Call It', 'Word Chain'])).toBe('Ghost, Call It, Word Chain');
  });
  it('adds "and more" past three and names only the first three', () => {
    expect(gamesSubtitle(['A', 'B', 'C', 'D'])).toBe('A, B, C and more');
  });
});

describe('isNotesMenu', () => {
  it('is false for short action titles', () => {
    expect(isNotesMenu([{ title: 'View profile' }, { title: 'Gift a shield' }])).toBe(false);
  });
  it('is true when any non-danger title is longer than 18 characters', () => {
    expect(isNotesMenu([{ title: 'Good luck today, friend!' }, { title: 'Nice' }])).toBe(true);
    expect(isNotesMenu([{ title: 'A'.repeat(18) }])).toBe(false);
    expect(isNotesMenu([{ title: 'A'.repeat(19) }])).toBe(true);
  });
  it('ignores danger rows', () => {
    expect(isNotesMenu([{ title: 'Remove this person from my list', danger: true }, { title: 'Hi' }])).toBe(false);
  });
});
