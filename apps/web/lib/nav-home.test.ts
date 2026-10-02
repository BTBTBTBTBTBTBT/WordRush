import { afterEach, describe, expect, it } from 'vitest';
import { leaveGuard, setLeaveGuard, tabTapAction } from './nav-home';

describe('footer tabs always go home (FINISH_SPEC AJ)', () => {
  afterEach(() => setLeaveGuard(null));
  it('lands on the tab root from any depth', () => {
    // Three levels deep: a game → its help popup → Home tab.
    expect(tabTapAction({ pathname: '/quadword', search: '?daily=true', href: '/' })).toBe('navigate');
    expect(tabTapAction({ pathname: '/guides/classic', href: '/' })).toBe('navigate');
    expect(tabTapAction({ pathname: '/profile/abc', href: '/stats' })).toBe('navigate');
  });
  it('re-tapping the current tab at its root scrolls to the top; a sub-view pops to the root', () => {
    expect(tabTapAction({ pathname: '/', href: '/' })).toBe('scrollTop');
    expect(tabTapAction({ pathname: '/stats', search: '?view=DUEL', href: '/stats' })).toBe('navigate');
    expect(tabTapAction({ pathname: '/friends', href: '/friends' })).toBe('scrollTop');
  });
  it('asks first during a live VS match', () => {
    setLeaveGuard('Leave the match? It counts as a forfeit.');
    expect(leaveGuard()).toBe('Leave the match? It counts as a forfeit.');
    expect(tabTapAction({ pathname: '/practice/vs', href: '/', guarded: !!leaveGuard() })).toBe('confirm');
    setLeaveGuard(null);
    expect(leaveGuard()).toBeNull();
  });
});
