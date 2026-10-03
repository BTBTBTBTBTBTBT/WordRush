import { afterEach, describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { _resetTabScrollForTests, isTabRoot, leaveGuard, rememberTabScroll, rememberedTabScroll, setLeaveGuard, tabTapAction } from './nav-home';

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

describe('tab switches keep each tab\'s scroll position (FINISH_SPEC BI11)', () => {
  afterEach(() => _resetTabScrollForTests());
  it('a return from another tab restores the root where it was left; only a re-tap scrolls to the top', () => {
    // Home scrolled halfway → Leaderboard → Home: a navigate (no scrollTop), Home restores 640.
    rememberTabScroll('/', 640);
    expect(tabTapAction({ pathname: '/daily', href: '/' })).toBe('navigate');
    expect(rememberedTabScroll('/')).toBe(640);
    // Out of a game with the top-left Home button: same position.
    expect(tabTapAction({ pathname: '/quadword', search: '?daily=true', href: '/' })).toBe('navigate');
    expect(rememberedTabScroll('/')).toBe(640);
    // Every tab keeps its own.
    rememberTabScroll('/stats', 300);
    expect(rememberedTabScroll('/stats')).toBe(300);
    expect(rememberedTabScroll('/friends')).toBe(0);
    // A re-tap at the root is the one scroll to the top.
    expect(tabTapAction({ pathname: '/', href: '/' })).toBe('scrollTop');
  });
  it('only tab roots are remembered', () => {
    expect(isTabRoot('/')).toBe(true);
    expect(isTabRoot('/quadword')).toBe(false);
    rememberTabScroll('/quadword', 500);
    expect(rememberedTabScroll('/quadword')).toBe(0);
  });
  it('the footer never jumps to the top on a switch, and Home remembers its column', () => {
    const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');
    expect(read('components/ui/bottom-nav.tsx')).toContain('scroll={false}');
    expect(read('components/ui/desktop-tabs.tsx')).toContain('scroll={false}');
    expect(read('components/ui/bottom-nav.tsx')).toContain('useTabScrollMemory(');
    expect(read('app/page.tsx')).toContain("useTabScrollMemory('/', homeScrollRef)");
  });
});
