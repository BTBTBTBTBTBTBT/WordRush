'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Crown, Home } from 'lucide-react';
import { GameMode } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { lookupInviteByCode } from '@/lib/invite-service';

/** Shared "this is a Pro perk" screen — one look for every route-level gate. */
function GateCard({ title, blurb, fallbackHref, fallbackLabel }: {
  title: string;
  blurb: string;
  fallbackHref: string;
  fallbackLabel: string;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div
        className="w-full max-w-sm text-center p-6 space-y-4"
        style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)', borderRadius: '20px' }}
      >
        <div
          className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
        >
          <Crown className="w-7 h-7 text-white" />
        </div>
        <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{title}</h1>
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{blurb}</p>
        <div className="space-y-2">
          <Link
            href="/pro"
            className="block w-full py-3 rounded-xl font-black text-white text-sm"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
          >
            Go Pro
          </Link>
          <Link
            href={fallbackHref}
            className="block w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text)', border: '1.5px solid var(--color-border)' }}
          >
            {fallbackLabel}
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 justify-center w-full py-2 text-xs font-bold"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Home className="w-3.5 h-3.5" /> Home
          </Link>
        </div>
      </div>
    </div>
  );
}

/** Entitlement isn't known yet — show nothing decisive either way. */
function GateLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="text-lg font-black animate-pulse" style={{ color: 'var(--color-text)' }}>Loading...</div>
    </div>
  );
}

/**
 * Pro gate for non-daily (unlimited) play. The game routes (/quordle, /six,
 * …) take any seed when `?daily=true` is absent, and share pages link
 * straight to them — so without this gate any free user with the URL got
 * unlimited fresh puzzles, while the home cards (and both native apps)
 * enforce one daily per mode. Daily play passes through untouched.
 */
export function UnlimitedGate({ isDaily, modeSlug, children }: {
  isDaily: boolean;
  /** Route slug used to send the player to today's daily instead. */
  modeSlug: string;
  children: React.ReactNode;
}) {
  const { loading, isProActive } = useAuth();

  if (isDaily || isProActive) return <>{children}</>;
  if (loading) return <GateLoading />;

  return (
    <GateCard
      title="Unlimited play is a Pro perk"
      blurb="Free players get a fresh daily puzzle in every mode. Go Pro for unlimited replays, no ads, and rematches."
      fallbackHref={`/${modeSlug}?daily=true`}
      fallbackLabel="Play today's daily"
    />
  );
}

/**
 * The same gate, for the VS routes (/quordle/vs, /six/vs, …) — the sibling
 * hole to the one above, and for the same reason: the lobby's mode rows are
 * Pro-gated but the ROUTES were not, so a bookmarked or typed
 * /quordle/vs handed any signed-in free user unlimited live VS in all nine
 * modes plus invite creation — two of the three bullets /pro sells.
 *
 * Two doors stay open, because neither is a Pro perk:
 *  - Daily VS: one free Classic match a day. Mirrors vs-game's
 *    `dailyVsActive` exactly (DUEL + ?daily=true) so there is one rule, not
 *    two that can drift.
 *  - An invite a Pro friend sent: the invitee never needed Pro (native does
 *    the same — /vs/join/<code> accepts without an entitlement check). The
 *    code is looked up rather than trusted, or two free players could simply
 *    agree on a made-up ?inviteCode= and pair privately forever. Codes can
 *    only be minted by Pro, so a real one is proof of a Pro host; status
 *    isn't checked because it flips to 'accepted' the moment the match
 *    starts and a mid-match reload must not get gated out.
 */
export function VsProGate({ mode, isDaily = false, inviteCode, children }: {
  mode: GameMode;
  isDaily?: boolean;
  inviteCode?: string;
  children: React.ReactNode;
}) {
  const { loading, isProActive } = useAuth();
  const freeDailyVs = isDaily && mode === GameMode.DUEL;
  // null = still checking. Skipped entirely when the gate is already open.
  const [inviteValid, setInviteValid] = useState<boolean | null>(null);
  const needsInviteCheck = !!inviteCode && !loading && !isProActive && !freeDailyVs;

  useEffect(() => {
    if (!needsInviteCheck || !inviteCode) return;
    let cancelled = false;
    lookupInviteByCode(inviteCode)
      .then((invite) => {
        if (cancelled) return;
        setInviteValid(!!invite && new Date(invite.expires_at).getTime() > Date.now());
      })
      // Fail closed: a lookup that never answers can't be a proof of Pro.
      .catch(() => { if (!cancelled) setInviteValid(false); });
    return () => { cancelled = true; };
  }, [needsInviteCheck, inviteCode]);

  if (freeDailyVs || isProActive) return <>{children}</>;
  if (loading) return <GateLoading />;
  if (needsInviteCheck) {
    if (inviteValid === null) return <GateLoading />;
    if (inviteValid) return <>{children}</>;
  }

  return (
    <GateCard
      title="VS in every mode is a Pro perk"
      blurb="Free players get one Classic VS match a day. Go Pro for live VS in all nine modes, private matches, and rematches."
      fallbackHref="/practice/vs?daily=true"
      fallbackLabel="Play today's daily VS"
    />
  );
}
