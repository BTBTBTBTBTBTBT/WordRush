import { describe, expect, it } from 'vitest';
import { castColorForAccent } from './cast-accent';

describe('castColorForAccent (founder 10-09: Your board wears the game color)', () => {
  it('maps hue bands to the nearest family cast color', () => {
    expect(castColorForAccent('#ff0000')).toBe('pink'); // 0 deg
    expect(castColorForAccent('#ff00aa')).toBe('pink'); // ~320 deg falls through to pink
    expect(castColorForAccent('#ff8000')).toBe('orange'); // 30 deg
    expect(castColorForAccent('#ffc800')).toBe('gold'); // 47 deg
    expect(castColorForAccent('#00ff00')).toBe('green'); // 120 deg
    expect(castColorForAccent('#00ffcc')).toBe('teal'); // 168 deg
    expect(castColorForAccent('#0066ff')).toBe('blue'); // 220 deg
    expect(castColorForAccent('#8800ff')).toBe('purple'); // 272 deg
  });
  it('low saturation is slate; bad input falls back to gold', () => {
    expect(castColorForAccent('#888888')).toBe('slate');
    expect(castColorForAccent('#fff')).toBe('slate');
    expect(castColorForAccent('nope')).toBe('gold');
  });
  it('accepts short hex', () => {
    expect(castColorForAccent('#f00')).toBe('pink');
  });
});
