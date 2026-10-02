import { describe, it, expect } from 'vitest';
import { stripEmoji } from './strip-emoji';

describe('stripEmoji', () => {
  it('drops emoji and tidies the spaces they leave', () => {
    expect(stripEmoji('Image copied! Paste it anywhere 📋')).toBe('Image copied! Paste it anywhere');
    expect(stripEmoji('Saved! Share it anywhere 🖼️')).toBe('Saved! Share it anywhere');
    expect(stripEmoji('A shield saved your streak 🛡️ Phew!')).toBe('A shield saved your streak Phew!');
    expect(stripEmoji('Your 🔥 12-day streak')).toBe('Your 12-day streak');
    expect(stripEmoji('Nice 👍🏽 !')).toBe('Nice!');
  });
  it('keeps typographic glyphs', () => {
    expect(stripEmoji('✓ solved → next ★ © Wordocious')).toBe('✓ solved → next ★ © Wordocious');
  });
});
