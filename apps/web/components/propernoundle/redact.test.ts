import { describe, it, expect } from 'vitest';
import { redactAnswer } from './wikipedia';

// §262: the clue for OLYMPICS opened "The modern Olympic Games…" — an exact
// match misses the answer's own inflections. iOS/Android mirror this rule.
describe('redactAnswer', () => {
  it('redacts inflections of the answer, not just the exact word', () => {
    const clue = 'The modern Olympic Games are a series of events. The Olympics are held every four years; an Olympian competes.';
    const out = redactAnswer(clue, 'Olympics');
    expect(out).not.toMatch(/olympi/i);
    expect(out).toContain('______ Games');
  });
  it('redacts each word of a multi-word name and its inflections', () => {
    expect(redactAnswer('Swift is a singer; Swifties adore Taylor.', 'Taylor Swift')).not.toMatch(/swift|taylor/i);
  });
  it('leaves unrelated words alone', () => {
    expect(redactAnswer('A red planet named for the Roman god of war.', 'Mars')).toBe('A red planet named for the Roman god of war.');
    expect(redactAnswer('The company makes shoes.', 'Nike')).toBe('The company makes shoes.');
  });
  it('still matches accented spellings', () => {
    expect(redactAnswer('The Shōgun ruled Japan.', 'Shogun')).toBe('The ______ ruled Japan.');
  });
});
