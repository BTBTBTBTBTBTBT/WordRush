'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Home } from 'lucide-react';
import { Icon3D } from '@/components/ui/icon3d';
import { GameMode } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { lookupInviteByCode } from '@/lib/invite-service';
import { loadCpuProgression } from '@/lib/bot/cpu-progression';
import { utcDay } from '@/lib/vs-lobby';
import { VsLoadingScreen } from '@/components/vs/vs-ui';
import { GameLoading } from '@/components/game/game-loading';
import { CandyButton, CandyLink } from '@/components/ui/candy-button';
import { CastButton, CastLink } from '@/components/ui/cast-button';
import { openGoProPopup } from '@/lib/payment/go-pro-popup';
import { StateCard } from '@/components/ui/soft-popup';
import { ART_SIZE, artSrc } from '@/lib/art';
import { softBackground } from '@/lib/soft-surface';

const CROWN = 'art-scene-pro-crown' as const;
/** FINISH_SPEC R3: the Unlimited gate wears U's candy-tile loop, in the peach card language. */
const LOOP = 'art-scene-unlimited-loop' as const;
const PEACH = '#fb923c';

/**
 * Shared "this is a Pro perk" screen — one look for every route-level gate
 * (FINISH_SPEC G1 / G5): the gold Pro card with its top bar, W crowned with
 * the golden star, the amber Go Pro candy, the fallback in purple and Home in
 * the quiet peach.
 */
function GateCard({ title, blurb, fallbackHref, fallbackLabel, unlimited = false }: {
  title: string;
  blurb: string;
  fallbackHref: string;
  fallbackLabel: string;
  /** R3: the Unlimited gate — U's loop art on the peach card. */
  unlimited?: boolean;
}) {
  const art = unlimited ? LOOP : CROWN;
  const [cw, ch] = ART_SIZE[art];
  const tone = unlimited ? PEACH : '#f5a524';
  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: softBackground(tone, 0.08) }}>
      <StateCard accent={tone} gradient={unlimited ? 'linear-gradient(90deg, #ffd6c2, #fb923c 55%, #f97316)' : 'linear-gradient(90deg, #ffd166, #f5a524 55%, #f97316)'} style={{ background: softBackground(tone, 0.15) }}>
        <div className="space-y-4">
          <Image
            src={artSrc(art)}
            alt=""
            aria-hidden="true"
            width={cw}
            height={ch}
            priority
            draggable={false}
            sizes="110px"
            className={`mx-auto select-none pointer-events-none art-pop ${unlimited ? 'loop-wobble' : ''}`}
            style={{ height: 130, width: 'auto', filter: 'drop-shadow(0 6px 10px rgba(180, 83, 9, 0.25))' }}
          />
          <h1 className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{title}</h1>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>{blurb}</p>
          <div className="flex flex-col items-stretch gap-1">
            {unlimited ? (
              // R3: the redesigned Go Pro popup; a purchase lands right back in this Unlimited game.
              <CastButton color="amber" size="lg" block icon={<Icon3D name="crown" size={24} />} onClick={() => openGoProPopup({ afterPurchaseHref: window.location.pathname, reason: 'Unlimited play' })}>
                Go Pro
              </CastButton>
            ) : (
              <CastLink href="/pro" color="amber" size="lg" block icon={<Icon3D name="crown" size={24} />}>
                Go Pro
              </CastLink>
            )}
            <CastLink href={fallbackHref} color="purple" size="md" block>
              {fallbackLabel}
            </CastLink>
            <div className="flex justify-center">
              <CastLink href="/" color="peach" size="sm" icon={<Home className="w-3.5 h-3.5" strokeWidth={3} aria-hidden="true" />}>
                Home
              </CastLink>
            </div>
          </div>
        </div>
      </StateCard>
    </div>
  );
}

/** Entitlement isn't known yet — show nothing decisive either way. */
function GateLoading() {
  return <GameLoading />;
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
  const { loading, isProActive, refreshProfile } = useAuth();
  // R3: back from a Go Pro checkout (?purchase=success): the entitlement lands
  // via the webhook, so poll the profile for a few seconds and then start the
  // Unlimited game directly instead of flashing the gate.
  const searchParams = useSearchParams();
  const justBought = searchParams?.get('purchase') === 'success';
  const [waiting, setWaiting] = useState(justBought);
  useEffect(() => {
    if (!justBought || isDaily || isProActive) { setWaiting(false); return; }
    let tries = 0;
    const t = setInterval(() => {
      tries += 1;
      refreshProfile();
      if (tries >= 8) { clearInterval(t); setWaiting(false); }
    }, 1500);
    return () => clearInterval(t);
  }, [justBought, isDaily, isProActive, refreshProfile]);

  if (isDaily || isProActive) return <>{children}</>;
  if (loading || waiting) return <GateLoading />;

  return (
    <GateCard
      title="Unlimited play is a Pro perk"
      blurb="Free players get a fresh daily puzzle in every mode. Go Pro for unlimited replays, no ads, and rematches."
      fallbackHref={`/${modeSlug}?daily=true`}
      fallbackLabel="Play today's daily"
      unlimited
    />
  );
}

/**
 * The same gate, for the VS routes (/quordle/vs, /six/vs, …) — the sibling
 * hole to the one above, and for the same reason: the lobby's mode rows are
 * Pro-gated but the ROUTES were not, so a bookmarked or typed
 * /quordle/vs handed any signed-in free user unlimited live VS in every mode
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
  // A third free door (VS overhaul §7): the Bot of the Day, Classic, once per
  // UTC day (?cpu=daily). Read after mount — the progression is localStorage.
  const searchParams = useSearchParams();
  const wantsBotOfDay = searchParams?.get('cpu') === 'daily' && mode === GameMode.DUEL;
  const [botOfDayOpen, setBotOfDayOpen] = useState<boolean | null>(null);
  useEffect(() => {
    if (!wantsBotOfDay) return;
    setBotOfDayOpen(loadCpuProgression().botOfDayPlayedDay !== utcDay());
  }, [wantsBotOfDay]);
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
  if (loading) return <VsLoadingScreen mode={mode} />;
  if (wantsBotOfDay) {
    if (botOfDayOpen === null) return <VsLoadingScreen mode={mode} />;
    if (botOfDayOpen) return <>{children}</>;
    return (
      <GateCard
        title="You played today’s Bot of the Day"
        blurb="A new bot battle opens at midnight UTC. Go Pro for the full bot ladder and live VS in every mode."
        fallbackHref="/vs"
        fallbackLabel="Back to VS"
      />
    );
  }
  if (needsInviteCheck) {
    if (inviteValid === null) return <VsLoadingScreen mode={mode} />;
    if (inviteValid) return <>{children}</>;
  }

  return (
    <GateCard
      title="VS in every mode is a Pro perk"
      blurb="Free players get one Classic VS match a day. Go Pro for live VS in every mode, private matches, and rematches."
      fallbackHref="/practice/vs?daily=true"
      fallbackLabel="Play today's daily VS"
    />
  );
}
