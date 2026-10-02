'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { useAuth } from '@/lib/auth-context';
import { loadFriends, getIncoming, onFriendsChange } from '@/lib/friends-service';
import { loadGames, getActiveGames, onGamesChange } from '@/lib/friendly-games-client';
import { fetchPendingInvitesForUser } from '@/lib/invite-service';
import { fetchVsChallenges } from '@/lib/vs-challenges-client';
import { friendsTabLabel, markSeen, seenStorageKey, unseenCount, waitingKeys } from '@/lib/friends-badge';
import { prefersReducedMotion } from '@/lib/motion';
import { CandyBadge } from '@/components/ui/candy-badge';
import { feedback } from '@/lib/sound-events';
import { closeAllOverlays, leaveGuard, setLeaveGuard, tabTapAction } from '@/lib/nav-home';
import { CandyButton } from '@/components/ui/candy-button';
import { popupCard, PopupBar } from '@/components/ui/soft-popup';

// D1 of the Stats + Friends redesign (founder, 2026-09-26, "option 2"): Profile
// and Records merge into Stats; Friends gets its own tab. iOS RootTabView and
// Android MainScreen carry the same four.
// HEADER_SPEC §3: the 3D tab icons. Selected: full color and the label in
// #6d28d9 900 with a 3 px purple underline pill; unselected: 55% opacity, 60%
// saturation, muted label. The Friends tab wears the candy count badge (FINISH_SPEC M).
// FINISH_SPEC A4 (replaces the §18.3 floating pill): DOCKED — flush to the
// bottom edge, edge to edge, opaque, a soft page-tinted gradient (lilac Home,
// warm Leaderboard, blue Stats, pink Friends) with a faint top line; the
// home-indicator / safe area is part of the bar (globals.css .tab-dock) and the
// page content ends above it (--bottom-nav-h). Each tab icon squishes on tap
// (A9, components/ui/squish-host.tsx).
/** The bar's tint follows the page (A4): Leaderboard + Records warm, Stats blue, Friends pink, the rest lilac. */
export function tabTint(pathname: string | null): 'home' | 'leaderboard' | 'stats' | 'friends' {
  const p = pathname ?? '/';
  if (p.startsWith('/daily') || p.startsWith('/records')) return 'leaderboard';
  if (p.startsWith('/stats') || p.startsWith('/profile')) return 'stats';
  if (p.startsWith('/friends')) return 'friends';
  return 'home';
}

const NAV_ITEMS: { href: string; label: string; icon: Icon3DName }[] = [
  { href: '/', label: 'Home', icon: 'tab-home' },
  { href: '/daily', label: 'Leaderboard', icon: 'tab-leaderboard' },
  { href: '/stats', label: 'Stats', icon: 'tab-stats' },
  { href: '/friends', label: 'Friends', icon: 'tab-friends' },
];

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  // FINISH_SPEC AJ: a tab tap from ANY depth lands on that tab's root at the top
  // and closes every overlay; the one exception (a live VS match) asks first.
  const [confirmHref, setConfirmHref] = useState<string | null>(null);
  const onTabTap = (e: React.MouseEvent, href: string) => {
    const action = tabTapAction({ pathname: pathname ?? '/', search: typeof window !== 'undefined' ? window.location.search : '', href, guarded: !!leaveGuard() });
    if (action === 'confirm') { e.preventDefault(); setConfirmHref(href); return; }
    closeAllOverlays();
    if (action === 'scrollTop') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  };
  const ref = useRef<HTMLElement | null>(null);
  // FINISH_SPEC M: the Friends tab's candy badge = incoming requests + game
  // invites / VS challenges waiting on the player + friendly games where it's
  // their turn (lib/friends-badge.ts), counting only what they haven't seen.
  // Opening Friends marks it all seen; it returns only for new items. A new
  // item springs the badge in and wiggles the tab icon; the badge's glow
  // pulses while unseen (CSS, off with Reduce Motion).
  const { user } = useAuth();
  const [keys, setKeys] = useState<string[]>([]);
  const [seen, setSeen] = useState<Set<string>>(() => new Set());
  const [pop, setPop] = useState(0);
  const extra = useRef<{ invites: string[]; challenges: string[] }>({ invites: [], challenges: [] });
  const friendsIconRef = useRef<HTMLSpanElement | null>(null);
  useEffect(() => {
    if (!user) { setKeys([]); return; }
    try { setSeen(new Set(JSON.parse(localStorage.getItem(seenStorageKey(user.id)) ?? '[]') as string[])); } catch { setSeen(new Set()); }
    let alive = true;
    const sync = () => {
      if (!alive) return;
      setKeys(waitingKeys({
        requests: getIncoming().map((f) => f.id),
        invites: extra.current.invites,
        challenges: extra.current.challenges,
        turns: getActiveGames().filter((g) => g.status === 'active' && g.yourTurn).map((g) => ({ id: g.id, updatedAt: g.updatedAt })),
      }));
    };
    loadFriends().then(sync);
    loadGames().then(sync);
    // The invites + challenges the Friends / VS screens already load (no new backend).
    fetchPendingInvitesForUser(user.id).then((list) => { extra.current.invites = list.map((i) => i.id); sync(); }).catch(() => {});
    fetchVsChallenges().then((c) => { extra.current.challenges = c.incoming.map((x) => x.code); sync(); }).catch(() => {});
    const offFriends = onFriendsChange(sync);
    const offGames = onGamesChange(sync);
    return () => { alive = false; offFriends(); offGames(); };
  }, [user]);

  const onFriends = (pathname ?? '').startsWith('/friends');
  // Opening Friends marks everything waiting as seen (and keeps marking while there).
  useEffect(() => {
    if (!user || !onFriends || keys.length === 0) return;
    if (keys.every((k) => seen.has(k))) return;
    const next = markSeen([...keys]);
    setSeen(new Set(next));
    try { localStorage.setItem(seenStorageKey(user.id), JSON.stringify(next)); } catch {}
  }, [user, onFriends, keys, seen]);

  const badge = onFriends ? 0 : unseenCount(keys, seen);
  // A new item: spring the badge in and wiggle the tab icon.
  const prevBadge = useRef(0);
  useEffect(() => {
    if (badge > prevBadge.current) {
      setPop((n) => n + 1);
      feedback('notify'); // FINISH_SPEC U: the Friends badge pops = `notify` + light haptic
      const icon = friendsIconRef.current;
      if (icon && !prefersReducedMotion()) {
        icon.classList.remove('tab-wiggle');
        void icon.offsetWidth;
        icon.classList.add('tab-wiggle');
        icon.addEventListener('animationend', () => icon.classList.remove('tab-wiggle'), { once: true });
      }
    }
    prevBadge.current = badge;
  }, [badge]);

  // Publish the room the nav takes at the bottom of the screen (the docked bar
  // including the safe area) as --bottom-nav-h on <html> so
  // the fixed AdBanner (mounted globally in layout.tsx) can stack directly
  // above the nav instead of covering it. ResizeObserver + resize keep it fresh
  // across safe-area/orientation changes; the cleanup resets to 0 on routes
  // that don't render a BottomNav.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const root = document.documentElement;
    const publish = () => {
      const room = Math.max(el.offsetHeight, Math.round(window.innerHeight - el.getBoundingClientRect().top));
      root.style.setProperty('--bottom-nav-h', `${room}px`);
    };
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    window.addEventListener('resize', publish);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', publish);
      root.style.setProperty('--bottom-nav-h', '0px');
    };
  }, []);

  return (
    <>
    <nav
      ref={ref}
      className="tab-dock fixed left-0 right-0 bottom-0 z-40 grid grid-cols-4"
      data-tab-tint={tabTint(pathname)}
      aria-label="Main navigation"
    >
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={(e) => onTabTap(e, item.href)}
            className="flex flex-col items-center gap-0.5 pt-0.5 pb-0.5 min-w-0"
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.href === '/friends' ? friendsTabLabel(badge) : item.label}
          >
            <span className="relative" ref={item.href === '/friends' ? friendsIconRef : undefined}>
              <span
                className="tab-squish block transition-[opacity,filter] duration-200"
                style={{
                  opacity: isActive ? 1 : 0.55,
                  filter: isActive ? 'none' : 'saturate(0.6)',
                }}
              >
                <Icon3D name={item.icon} size={30} priority />
              </span>
              {item.href === '/friends' && badge > 0 && (
                // The tab's label already says "Friends, N new".
                <CandyBadge key={pop} count={badge} pop pulse className="absolute" style={{ top: -6, right: -11 }} />
              )}
            </span>
            <span
              className={`text-[11px] transition-colors ${isActive ? 'font-black' : 'font-extrabold'}`}
              style={{ color: isActive ? '#6d28d9' : '#8a78ad' }}
            >
              {item.label}
            </span>
            {/* The selected tab's 3 px purple underline pill (space kept on every tab). */}
            <span
              aria-hidden="true"
              className="block rounded-full"
              style={{ width: 22, height: 3, background: '#7c3aed', opacity: isActive ? 1 : 0 }}
            />
          </Link>
        );
      })}
    </nav>
    {confirmHref && (
      // AJ: leaving a live VS match counts as a forfeit, so ask (never silently forfeit).
      <div className="fixed inset-0 z-[95] flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(30, 15, 60, 0.45)' }} onClick={() => setConfirmHref(null)}>
        <div role="alertdialog" aria-modal="true" aria-label="Leave the match?" className="relative w-full max-w-xs text-center" style={popupCard('#0d9488', { radius: 22 })} onClick={(e) => e.stopPropagation()}>
          <PopupBar accent="#0d9488" />
          <div className="px-4 pt-3 pb-4">
            <p className="m-0 text-[15px] font-black" style={{ color: 'var(--color-text)' }}>{leaveGuard() ?? 'Leave the match? It counts as a forfeit.'}</p>
            <div className="mt-3 flex justify-center gap-2">
              <CandyButton color="teal" size="md" onClick={() => setConfirmHref(null)}>Stay</CandyButton>
              <CandyButton color="peach" size="md" onClick={() => { const href = confirmHref; setConfirmHref(null); setLeaveGuard(null); closeAllOverlays(); router.push(href); }}>Leave</CandyButton>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
