import { describe, expect, it } from 'vitest';
import { pickHomeOffer } from './home-offer';

describe('pickHomeOffer', () => {
  it('shows only one card: the season nudge wins during the season', () => {
    expect(pickHomeOffer({ seasonDue: true, partyHat: true })).toBe('season');
  });
  it('shows the party hat when no season nudge is due', () => {
    expect(pickHomeOffer({ seasonDue: false, partyHat: true })).toBe('partyhat');
  });
  it('shows the season nudge alone', () => {
    expect(pickHomeOffer({ seasonDue: true, partyHat: false })).toBe('season');
  });
  it('shows nothing when neither is pending', () => {
    expect(pickHomeOffer({ seasonDue: false, partyHat: false })).toBeNull();
  });
});
