import { describe, expect, it } from 'vitest';
import { feedbackKind, feedbackTone, scoreLabel } from './feedback-toast';

describe('feedbackKind', () => {
  it('reads a plain score', () => {
    expect(feedbackKind('+5')).toEqual({ kind: 'score', points: 5, pangram: false, label: 'Nice!' });
    expect(feedbackKind('+1')).toMatchObject({ kind: 'score', points: 1, label: 'Good!' });
  });

  it('reads a pangram score (any case, optional space)', () => {
    expect(feedbackKind('Pangram! +14')).toEqual({ kind: 'score', points: 14, pangram: true, label: 'PANGRAM!' });
    expect(feedbackKind('pangram!+15')).toMatchObject({ kind: 'score', pangram: true, points: 15 });
  });

  it('does not treat other text with numbers as a score', () => {
    expect(feedbackKind('+5 bonus').kind).toBe('message');
    expect(feedbackKind('2 wrong letters cleared').kind).toBe('message');
  });

  it('labels scores by size', () => {
    expect(scoreLabel(4, false)).toBe('Good!');
    expect(scoreLabel(5, false)).toBe('Nice!');
    expect(scoreLabel(6, false)).toBe('Nice!');
    expect(scoreLabel(7, false)).toBe('Great!');
    expect(scoreLabel(8, false)).toBe('Amazing!');
    expect(scoreLabel(3, true)).toBe('PANGRAM!');
  });
});

describe('feedbackTone', () => {
  it('wins', () => {
    expect(feedbackTone('Rank up: Buzzing')).toBe('win');
    expect(feedbackTone('Solved!')).toBe('win');
    expect(feedbackTone('Great find')).toBe('win');
  });
  it('successes', () => {
    expect(feedbackTone('Copied!')).toBe('success');
    expect(feedbackTone('Challenge sent')).toBe('success');
    expect(feedbackTone('Saved')).toBe('success');
  });
  it('errors', () => {
    expect(feedbackTone('Not in word list')).toBe('error');
    expect(feedbackTone('Already guessed')).toBe('error');
    expect(feedbackTone('Word must be 5 letters')).toBe('error');
    expect(feedbackTone('Four letters or more')).toBe('error');
    expect(feedbackTone('Not enough letters')).toBe('error');
    expect(feedbackTone('Missing center letter')).toBe('error');
  });
  it('losses', () => {
    expect(feedbackTone('The word was CRANE')).toBe('loss');
    expect(feedbackTone('Out of guesses')).toBe('loss');
  });
  it('falls back to info', () => {
    expect(feedbackTone('Tap again to reveal')).toBe('info');
    expect(feedbackTone('One away…')).toBe('info');
  });
});
