'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { CandyButton, CandyIcon } from '@/components/ui/candy-button';
import { Icon3D } from '@/components/ui/icon3d';
import { Confetti, CANDY_CONFETTI } from '@/components/effects/confetti';
import { ART_SIZE, artSrc, badgeSrc } from '@/lib/art';
import { alphaHex, cardBarStyle, softBackground, softCard } from '@/lib/soft-surface';
import { feedback } from '@/lib/sound-events';
import {
  BENEFIT_STAGGER_MS,
  CROWN_DROP_EVENT,
  PRO_WELCOME_BENEFITS,
  PRO_WELCOME_EVENT,
  decideProWelcome,
  giftWelcomeDue,
  letsPlayHref,
  markProWelcomed,
  proWelcomeHeadline,
  proWelcomeLine,
  purchaseSignalFromSearch,
  readProWelcomed,
  shieldsCredited,
  type ProBenefitArt,
  type ProWelcomeKind,
  type ProWelcomeSignal,
} from '@/lib/pro-welcome';

// "Welcome to Pro" (docs/FINISH_SPEC.md AP): the one-time full-screen moment
// after a player's FIRST Pro purchase (the Stripe return, ?purchase=success)
// or a gifted week's first activation (the referral redeemer). Gold sunburst
// rays slowly turning, one burst of gold + cast-color confetti, the celebrate
// sound + success haptic, W crowned springing in, the gold lettering, the
// eight benefit cards popping in 70 ms apart, the shields chip when shields
// were credited, the gold LET'S PLAY candy (back where they were; the crown
// then drops onto W in the cast header via CROWN_DROP_EVENT) and the "Gift a
// friend a free week" link (T4, Friends). Reduce Motion: static rays, no
// confetti, no pops. The trigger decision is lib/pro-welcome.ts (tested).
// Mounted once in app/layout.tsx.

const GOLD = '#f5a524';
const GOLD_TEXT = 'linear-gradient(180deg, #ffe08a 0%, #ffc233 45%, #f5a524 70%, #f97316 100%)';
const CROWN = 'art-scene-pro-crown' as const;
const SHIELD = 'art-scene-shield-guard' as const;
/** Gold first, then the cast's candy colors. */
const CONFETTI = [...CANDY_CONFETTI.gold, '#f472b6', '#2dd4bf', '#60a5fa', '#a66bff'];

/** AA1: once the screen is gone, the crown drops onto W in the cast header, with a sparkle. */
function dropCrown(delayMs: number) {
  window.setTimeout(() => window.dispatchEvent(new CustomEvent(CROWN_DROP_EVENT)), delayMs);
}

interface Shown { kind: ProWelcomeKind; shields: boolean }

export function ProWelcomeHost() {
  const { user, session, profile, isProActive, refreshProfile } = useAuth();
  const sessionToken = useRef<string | null>(null);
  sessionToken.current = session?.access_token ?? null;
  const userId = user?.id ?? null;
  const [shown, setShown] = useState<Shown | null>(null);
  // This session's signal + the shield count when the session first saw the profile.
  const signal = useRef<ProWelcomeSignal | null>(null);
  const urlRead = useRef(false);
  const shieldsAtStart = useRef<number | null>(null);
  const [signalTick, setSignalTick] = useState(0);

  // A new account in this tab starts over.
  const lastUser = useRef<string | null>(null);
  if (lastUser.current !== userId) {
    lastUser.current = userId;
    shieldsAtStart.current = null;
    if (urlRead.current) signal.current = null;
  }

  // The referral redeemer's "Pro unlocked" claim (startProWelcome).
  useEffect(() => {
    const onSignal = (e: Event) => {
      const detail = (e as CustomEvent<ProWelcomeSignal>).detail;
      if (!detail) return;
      signal.current = detail;
      setSignalTick((n) => n + 1);
    };
    window.addEventListener(PRO_WELCOME_EVENT, onSignal);
    return () => window.removeEventListener(PRO_WELCOME_EVENT, onSignal);
  }, []);

  const shieldsNow = profile?.streak_shields ?? null;
  const decision = (() => {
    if (!userId || !profile || shown) return 'none' as const;
    return decideProWelcome({ welcomed: readProWelcomed(userId), proNow: isProActive, signal: signal.current });
  })();

  useEffect(() => {
    if (!userId || !profile) return;
    // The Stripe return, read once per page load before any decision.
    if (!urlRead.current) {
      urlRead.current = true;
      const fromUrl = purchaseSignalFromSearch(window.location.search);
      if (fromUrl && !signal.current) { signal.current = fromUrl; setSignalTick((n) => n + 1); }
    }
    if (shieldsAtStart.current === null) shieldsAtStart.current = profile.streak_shields ?? 0;
    const d = decideProWelcome({ welcomed: readProWelcomed(userId), proNow: isProActive, signal: signal.current });
    if (d === 'mark') {
      markProWelcomed(userId);
      signal.current = null;
      // Pro with no in-session signal: a gifted week redeemed elsewhere (another device, a
      // native app) still gets its welcome once — the server marker decides (GET /api/pro/gift).
      void (async () => {
        try {
          const token = sessionToken.current;
          if (!token) return;
          const res = await fetch('/api/pro/gift', { headers: { Authorization: `Bearer ${token}` } });
          const body = await res.json().catch(() => null);
          if (lastUser.current !== userId || !giftWelcomeDue(body?.gift?.redeemedAt)) return;
          setShown({ kind: 'gift', shields: false });
          feedback('celebrate');
        } catch { /* offline: the welcome is a nicety */ }
      })();
      return;
    }
    if (d !== 'show' || !signal.current) return;
    const s = signal.current;
    markProWelcomed(userId);
    signal.current = null;
    setShown({
      kind: s.kind,
      shields: shieldsCredited({ kind: s.kind, plan: s.plan, shieldsBefore: shieldsAtStart.current, shieldsNow }),
    });
    feedback('celebrate');
  }, [userId, profile, isProActive, shieldsNow, signalTick]);

  // A purchase is pending but the webhook hasn't landed: refresh the profile
  // for a little while (the Unlimited gate and the Pro page poll too).
  useEffect(() => {
    if (decision !== 'wait' || signal.current?.kind !== 'purchase') return;
    let tries = 0;
    const t = window.setInterval(() => {
      tries += 1;
      refreshProfile();
      if (tries >= 10) window.clearInterval(t);
    }, 2000);
    return () => window.clearInterval(t);
  }, [decision, refreshProfile]);

  if (!shown) return null;
  return <ProWelcome kind={shown.kind} shields={shown.shields} name={profile?.username} onClose={() => setShown(null)} />;
}

function BenefitArt({ art }: { art: ProBenefitArt }) {
  if ('icon' in art) return <Icon3D name={art.icon} size={46} />;
  const name = 'scene' in art ? (`art-scene-${art.scene}` as const) : (`art-badge-${art.badge}` as const);
  const [w, h] = ART_SIZE[name];
  return (
    <Image
      src={'scene' in art ? artSrc(name) : badgeSrc(art.badge)}
      alt=""
      aria-hidden
      width={w}
      height={h}
      sizes="64px"
      draggable={false}
      className="select-none pointer-events-none"
      style={{ height: 50, width: 'auto', maxWidth: 64, objectFit: 'contain', filter: 'drop-shadow(0 3px 5px rgba(76, 29, 149, 0.18))' }}
    />
  );
}

export function ProWelcome({ kind, shields, name, onClose }: {
  kind: ProWelcomeKind;
  shields: boolean;
  name?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref, true);
  const headline = proWelcomeHeadline(kind);

  const letsPlay = useCallback(() => {
    const href = letsPlayHref(pathname);
    onClose();
    if (href) router.push(href);
    dropCrown(href ? 450 : 120);
  }, [onClose, pathname, router]);

  // Escape = LET'S PLAY; the page under it doesn't scroll.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); letsPlay(); } };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [letsPlay]);

  const [cw, ch] = ART_SIZE[CROWN];
  const [sw, sh] = ART_SIZE[SHIELD];
  const lastDelay = 360 + PRO_WELCOME_BENEFITS.length * BENEFIT_STAGGER_MS;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-welcome-title"
      aria-describedby="pro-welcome-line"
      className="fixed inset-0 z-[95] overflow-y-auto overflow-x-hidden animate-fade-in"
      style={{ background: `radial-gradient(120% 70% at 50% 0%, ${alphaHex('#ffd166', 0.42)}, transparent 70%), ${softBackground(GOLD, 0.16)}` }}
    >
      {/* Gold sunburst rays behind W, slowly turning (Reduce Motion: static). */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 overflow-visible" style={{ top: 120, width: 0, height: 0 }}>
        <span
          className="absolute rp-rays"
          style={{
            left: -360, top: -360, width: 720, height: 720, borderRadius: '50%',
            background: `repeating-conic-gradient(${alphaHex(GOLD, 0.24)} 0deg 9deg, transparent 9deg 22.5deg)`,
            maskImage: 'radial-gradient(circle, #000 18%, transparent 68%)',
            WebkitMaskImage: 'radial-gradient(circle, #000 18%, transparent 68%)',
          }}
        />
      </div>
      <Confetti colors={CONFETTI} />

      <div className="relative mx-auto w-full max-w-md px-4 pt-6 pb-10 text-center" style={{ paddingTop: 'max(24px, env(safe-area-inset-top))' }}>
        <Image
          src={artSrc(CROWN)}
          alt=""
          aria-hidden
          width={cw}
          height={ch}
          priority
          sizes="160px"
          draggable={false}
          className="mx-auto select-none pointer-events-none rp-spring"
          style={{ height: 170, width: 'auto', filter: 'drop-shadow(0 10px 16px rgba(180, 83, 9, 0.3))' }}
        />
        <h1
          id="pro-welcome-title"
          className="m-0 mt-2 rp-pop"
          style={{
            fontWeight: 900,
            fontSize: kind === 'gift' ? 30 : 36,
            lineHeight: 1.05,
            letterSpacing: '0.01em',
            background: GOLD_TEXT,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 2px 0 #a24b0e) drop-shadow(0 5px 10px rgba(180, 83, 9, 0.3))',
            animationDelay: '220ms',
          }}
        >
          {headline}
        </h1>
        <p id="pro-welcome-line" className="m-0 mt-2 text-sm font-bold" style={{ color: 'var(--color-text-secondary)' }}>
          {proWelcomeLine(name)}
        </p>

        <ul className="m-0 mt-5 p-0 list-none grid grid-cols-2 gap-2.5 text-left">
          {PRO_WELCOME_BENEFITS.map((b, i) => (
            <li
              key={b.title}
              className="rp-pop flex flex-col overflow-hidden"
              style={{ ...softCard(b.accent, { radius: 16 }), animationDelay: `${360 + i * BENEFIT_STAGGER_MS}ms` }}
            >
              <span aria-hidden="true" style={cardBarStyle(b.accent, 6)} />
              <span className="flex flex-col items-start gap-1 px-2.5 pt-2 pb-2.5">
                <span className="grid place-items-center" style={{ height: 52 }}><BenefitArt art={b.art} /></span>
                <span className="text-[13px] font-black leading-tight" style={{ color: 'var(--color-text)' }}>{b.title}</span>
                <span className="text-[11px] font-bold leading-snug" style={{ color: 'var(--color-text-muted)' }}>{b.line}</span>
              </span>
            </li>
          ))}
        </ul>

        {shields && (
          <div
            className="rp-pop mt-4 inline-flex items-center gap-2 pl-1.5 pr-4 py-1.5"
            style={{ ...softCard('#6366f1', { radius: 999 }), animationDelay: `${lastDelay}ms` }}
          >
            <Image src={artSrc(SHIELD)} alt="" aria-hidden width={sw} height={sh} sizes="40px" draggable={false} className="select-none pointer-events-none" style={{ height: 34, width: 'auto' }} />
            <span className="text-[13px] font-black" style={{ color: 'var(--color-text)' }}>Your 4 streak shields are ready</span>
          </div>
        )}

        <CandyButton
          color="amber"
          size="lg"
          block
          className="mt-5"
          icon={<CandyIcon name="play" size={22} />}
          onClick={letsPlay}
        >
          LET&apos;S PLAY!
        </CandyButton>
        <Link
          href="/friends"
          onClick={() => { onClose(); dropCrown(450); }}
          className="inline-block mt-3 text-sm font-extrabold underline underline-offset-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Gift a friend a free week
        </Link>
      </div>
    </div>
  );
}
