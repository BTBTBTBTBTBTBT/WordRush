'use client';

import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarConfig } from '@wordle-duel/core';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase-client';
import { PageBackground } from '@/components/ui/page-background';
import { CandyButton } from '@/components/ui/candy-button';
import { CastHeader } from '@/components/ui/cast-header';
import { AuthModal } from '@/components/auth/auth-modal';
import { MascotAvatar } from '@/components/avatar/mascot-avatar';
import { MascotBuilder } from '@/components/avatar/mascot-builder';
import { usePlayerAvatar } from '@/components/avatar/player-avatar';
import { Confetti, CANDY_CONFETTI } from '@/components/effects/confetti';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { ART_SIZE, artSrc } from '@/lib/art';
import { CAST, mascotSrc, type MascotId } from '@/lib/mascots';
import { choiceForConfig, saveProfileWithAvatar, type ProfilesUpdater } from '@/lib/avatar-cast';
import { prefersReducedMotion } from '@/lib/motion';
import { INTRO_RUNNING_ATTR } from '@/lib/intro';
import { dailyHref } from '@/lib/mode-routes';
import { MODE_BY_DBKEY } from '@/lib/modes.generated';
import { feedback } from '@/lib/sound-events';
import { alphaHex } from '@/lib/soft-surface';
import { softNotice } from '@/components/ui/soft-popup';
import {
  TOUR_EVENT, TOUR_PARAM, hasPlayedLocally, isLegacyOnboarded, isOnboarded, localStorageKeys, markOnboarded,
  onboardingDecision, readResume, setResume,
} from '@/lib/onboarding';
import { UsernameStep } from './username-step';
import { MascotCoach } from './mascot-coach';

// First-run welcome + guided profile setup (docs/FINISH_SPEC.md AO, which
// supersedes W). After the cold-start intro, ONLY for brand-new players
// (lib/onboarding.ts decides; existing players get `onboarded-v2` silently):
//   1. WELCOME — the cast, "Let's go!" or "I already have an account" (sign in → Home).
//   2. QUICK TOUR — four swipe cards, one sentence each.
//   3. MAKE YOUR PROFILE — sign up with the existing auth, then pick a username
//      (or "Play as guest": skips 3–4, keeps the default mascot).
//   4. MAKE YOUR MASCOT — the AN builder with W coaching (spotlight tips).
//   5. ALL SET — the new mascot hops in next to W, confetti, "Play today's Classic" / "Explore first".
// Wallpaper, lettering-style headlines in soft-number ink, candy buttons,
// `whoosh` between steps, page dots, Skip top-right on 2–4; Reduce Motion =
// crossfades. How to Play's "Take the tour" (/?tour=1 or the `wordocious:tour`
// event) replays steps 1–2 only. Mounted once in app/layout.tsx.

const CLASSIC = 'DUEL';
const CLASSIC_ACCENT = MODE_BY_DBKEY[CLASSIC]?.accentHex ?? '#7c3aed';
const SWIPE_PX = 50;

type Step = 'welcome' | 'tour' | 'profile' | 'mascot' | 'done';
const STEPS: Step[] = ['welcome', 'tour', 'profile', 'mascot', 'done'];

type SceneName = 'art-scene-onboard-tiles' | 'art-scene-onboard-score' | 'art-scene-shield-guard' | 'art-scene-friends-match';

interface Card {
  art: SceneName;
  title: string;
  line: string;
}

const CARDS: Card[] = [
  { art: 'art-scene-onboard-tiles', title: 'DAILY GAMES', line: 'New puzzles every day. Guess the word, solve the board.' },
  { art: 'art-scene-onboard-score', title: 'SCORE BIG', line: 'Fewer guesses and faster times earn more points.' },
  { art: 'art-scene-shield-guard', title: 'KEEP YOUR STREAK', line: 'Play daily to grow your streak. Shields save it.' },
  { art: 'art-scene-friends-match', title: 'PLAY TOGETHER', line: 'Race friends, react, and battle the cast.' },
];

/** Load-then-show for art that may not be shipped yet (hidden cleanly when missing). */
function useArtReady(name: string): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let live = true;
    const img = new window.Image();
    img.onload = () => { if (live) setReady(img.naturalWidth > 0); };
    img.src = artSrc(name);
    return () => { live = false; };
  }, [name]);
  return ready;
}

function Headline({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="soft-num soft-num-auto m-0 text-center leading-none" style={{ fontSize: 32, letterSpacing: '0.03em' }}>
      {children}
    </h2>
  );
}

function Line({ children }: { children: React.ReactNode }) {
  return (
    <p className="m-0 text-center text-[15px] font-bold leading-snug" style={{ color: 'var(--color-text-secondary)', maxWidth: 360 }}>
      {children}
    </p>
  );
}

function TextLink({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[14px] font-extrabold underline underline-offset-4 px-2 py-1" style={{ color: 'var(--color-text-secondary)', background: 'transparent' }}>
      {children}
    </button>
  );
}

/** Springs its child in when it mounts (Reduce Motion: a crossfade). */
function StepIn({ reduced, children, className = '' }: { reduced: boolean; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== 'function') return;
    el.animate(
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'translateX(0)' }],
      { duration: reduced ? 200 : 360, easing: 'cubic-bezier(0.22, 0.8, 0.3, 1)' },
    );
  }, [reduced]);
  return <div ref={ref} className={className}>{children}</div>;
}

function TourCard({ card, index, active, artRef }: { card: Card; index: number; active: boolean; artRef: (el: HTMLDivElement | null) => void }) {
  const [w, h] = ART_SIZE[card.art];
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 w-full h-full px-5 mx-auto"
      style={{ maxWidth: 440 }}
      role="group"
      aria-roledescription="card"
      aria-label={`${index + 1} of ${CARDS.length}: ${card.title}`}
      aria-hidden={!active}
    >
      <div ref={artRef} className="flex items-end justify-center w-full" style={{ minHeight: 0, flex: '0 1 auto' }}>
        <Image
          src={artSrc(card.art)}
          alt=""
          aria-hidden
          width={w}
          height={h}
          priority={index === 0}
          draggable={false}
          sizes="(max-width: 480px) 90vw, 400px"
          className="block select-none pointer-events-none"
          style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '40vh' }}
        />
      </div>
      <Headline>{card.title}</Headline>
      <Line>{card.line}</Line>
    </div>
  );
}

/** The cast row with the player's mascot hopping in next to W (ALL SET fallback). */
function CastWithYou({ you, initial, reduced }: { you: AvatarConfig | null; initial: string; reduced: boolean }) {
  const youRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = youRef.current;
    if (!el) return;
    const t = setTimeout(() => {
      feedback('hop');
      if (reduced || typeof el.animate !== 'function') return;
      el.animate(
        [
          { transform: 'translate(60px, -70px) scale(0.5)', opacity: 0 },
          { transform: 'translate(10px, -36px) scale(0.9)', opacity: 1, offset: 0.45 },
          { transform: 'translate(0, 4px) scale(1.08, 0.9)', offset: 0.75 },
          { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        ],
        { duration: 720, easing: 'cubic-bezier(0.3, 1.2, 0.5, 1)', fill: 'backwards' },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [reduced]);
  const row: (MascotId | 'you')[] = you ? ['w', 'you', ...CAST.filter((c) => c !== 'w')] : [...CAST];
  return (
    <div className="flex items-end justify-center w-full" style={{ maxWidth: 440 }} aria-hidden="true">
      {row.map((id) => (
        <span key={id} className="flex-1 min-w-0 flex justify-center">
          {id === 'you' && you ? (
            <span ref={youRef} className="inline-block" style={{ transformOrigin: '50% 100%' }}>
              <MascotAvatar config={you} initial={initial} size={40} />
            </span>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mascotSrc(id as MascotId)} alt="" width={512} height={512} draggable={false} style={{ width: '100%', height: 'auto' }} />
          )}
        </span>
      ))}
    </div>
  );
}

export function FirstRunTour() {
  const { user, profile, loading, isProActive, enterGuest, refreshProfile } = useAuth();
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('welcome');
  const [replay, setReplay] = useState(false);
  const [index, setIndex] = useState(0);
  const [drag, setDrag] = useState(0);
  const [reduced, setReduced] = useState(false);
  const [tourAsked, setTourAsked] = useState(false);
  const [introRunning, setIntroRunning] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authNote, setAuthNote] = useState(false);
  const [draft, setDraft] = useState<AvatarConfig | null>(null);
  const [coach, setCoach] = useState(true);
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [avatarNote, setAvatarNote] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const builderRef = useRef<HTMLDivElement>(null);
  const artRefs = useRef<(HTMLDivElement | null)[]>([]);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const prevIndex = useRef(0);
  const prevStep = useRef<Step>('welcome');
  useFocusTrap(rootRef, open && !authOpen);

  const welcomeArt = useArtReady('art-scene-welcome-cast');
  const allSetArt = useArtReady('art-scene-all-set');
  const look = usePlayerAvatar({ name: profile?.username ?? null, userId: profile?.id ?? null });
  const p = profile as (Record<string, unknown> & { id: string; username?: string | null }) | null;

  // A replay: ?tour=1 on Home, or the tour event from anywhere.
  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get(TOUR_PARAM) === '1') setTourAsked(true);
    } catch { /* no URL */ }
  }, [pathname]);
  useEffect(() => {
    const onTour = () => setTourAsked(true);
    window.addEventListener(TOUR_EVENT, onTour);
    return () => window.removeEventListener(TOUR_EVENT, onTour);
  }, []);

  // Follow the cold-start intro (<html data-intro-running>): wait for it to clear.
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setIntroRunning(el.hasAttribute(INTRO_RUNNING_ATTR));
    read();
    const mo = new MutationObserver(read);
    mo.observe(el, { attributes: true, attributeFilter: [INTRO_RUNNING_ATTR] });
    return () => mo.disconnect();
  }, []);

  // Decide.
  useEffect(() => {
    if (open) return;
    const decision = onboardingDecision({
      tour: tourAsked,
      onboarded: isOnboarded(),
      legacyOnboarded: isLegacyOnboarded(),
      playedLocally: hasPlayedLocally(localStorageKeys()),
      authLoading: loading,
      signedIn: !!user,
      profile,
      pathname,
      introRunning,
    });
    if (decision === 'mark') markOnboarded();
    if (decision !== 'show') return;
    // A beat after the intro's landing flourish, then in. Back from a sign-up
    // redirect / email confirmation: pick up at the profile step.
    const first: Step = !tourAsked && readResume() ? 'profile' : 'welcome';
    const t = setTimeout(() => {
      setReduced(prefersReducedMotion());
      setReplay(tourAsked);
      setStep(first);
      prevStep.current = first;
      setIndex(0);
      prevIndex.current = 0;
      setOpen(true);
      feedback('whoosh');
    }, tourAsked ? 0 : 450);
    return () => clearTimeout(t);
  }, [open, tourAsked, loading, user, profile, pathname, introRunning]);

  const close = useCallback(() => {
    markOnboarded();
    setOpen(false);
    setTourAsked(false);
    setReplay(false);
    setDrag(0);
    // Drop ?tour=1 so a reload doesn't replay it.
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.has(TOUR_PARAM)) {
        url.searchParams.delete(TOUR_PARAM);
        window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      }
    } catch { /* no URL */ }
  }, []);

  const goStep = useCallback((s: Step) => {
    if (s === 'mascot') {
      setDraft(null);
      setCoach(true);
      setAvatarNote('');
    }
    setStep(s);
  }, []);

  const go = useCallback((n: number) => {
    setIndex(Math.max(0, Math.min(CARDS.length - 1, n)));
  }, []);

  // `whoosh` between steps and between cards; the new card's art springs in (Reduce Motion: none).
  useEffect(() => {
    if (!open) return;
    if (step !== prevStep.current) feedback('whoosh');
    prevStep.current = step;
  }, [open, step]);
  useEffect(() => {
    if (!open || step !== 'tour') return;
    if (index !== prevIndex.current) feedback('whoosh');
    prevIndex.current = index;
    const el = artRefs.current[index];
    if (!el || reduced || typeof el.animate !== 'function') return;
    el.animate(
      [
        { transform: 'translateY(18px) scale(0.6)', opacity: 0 },
        { transform: 'translateY(-4px) scale(1.06)', opacity: 1, offset: 0.62 },
        { transform: 'translateY(0) scale(1)', opacity: 1 },
      ],
      { duration: 560, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)', delay: 80, fill: 'backwards' },
    );
  }, [open, step, index, reduced]);

  // The mascot step starts from the player's current (default) mascot.
  useEffect(() => {
    if (open && step === 'mascot' && !draft && p) setDraft(look.config);
  }, [open, step, draft, p, look.config]);

  // Signed in while on the profile step: the sign-up part is done (the resume
  // flag is cleared when the flow ends — markOnboarded).
  useEffect(() => {
    if (user) setAuthNote(false);
  }, [user]);

  // Skip (top right): tour → profile; profile → guest; mascot → all set. A replay just closes.
  const skip = useCallback(() => {
    if (replay) { close(); return; }
    if (step === 'tour') goStep('profile');
    else if (step === 'profile') { if (!user) enterGuest(); goStep('done'); }
    else if (step === 'mascot') goStep('done');
  }, [replay, step, user, close, goStep, enterGuest]);

  // Keys: arrows move the tour cards, Escape skips.
  useEffect(() => {
    if (!open || authOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (replay) close(); else if (step !== 'welcome' && step !== 'done' && !(step === 'mascot' && coach)) skip(); }
      else if (step === 'tour' && e.key === 'ArrowRight') go(index + 1);
      else if (step === 'tour' && e.key === 'ArrowLeft') go(index - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, authOpen, replay, step, coach, index, close, skip, go]);

  const onAuthChange = (o: boolean) => {
    setAuthOpen(o);
    // Closed without a session: an email to confirm, or a change of heart.
    if (!o && !user && step === 'profile') setAuthNote(true);
  };

  const authModal = <AuthModal open={authOpen} onOpenChange={onAuthChange} />;
  if (!open) return authModal;

  const lastCard = index === CARDS.length - 1;
  const playHref = dailyHref(CLASSIC) ?? '/practice?daily=true';
  const showSkip = step === 'tour' || step === 'profile' || (step === 'mascot' && !coach);

  const haveAccount = () => {
    markOnboarded();
    setOpen(false);
    setAuthOpen(true);
    if (pathname !== '/') router.push('/');
  };
  const createAccount = () => {
    setResume(true);
    setAuthNote(false);
    setAuthOpen(true);
  };
  const playAsGuest = () => {
    enterGuest();
    goStep('done');
  };
  const saveMascot = async (config: AvatarConfig) => {
    if (!p) return;
    setAvatarSaving(true);
    setAvatarNote('');
    const res = await saveProfileWithAvatar(supabase as unknown as ProfilesUpdater, p.id, {}, choiceForConfig(config));
    setAvatarSaving(false);
    if (res.error) {
      setAvatarNote((res.error as { message?: string }).message ?? 'Could not save your mascot. Please try again.');
      return;
    }
    await refreshProfile();
    goStep('done');
  };
  const finish = (href?: string) => {
    close();
    if (href) router.push(href);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (step !== 'tour' || (e.pointerType === 'mouse' && e.button !== 0)) return;
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    // Rubber-band past the ends.
    const edge = (index === 0 && dx > 0) || (lastCard && dx < 0);
    if (!reduced) setDrag(edge ? dx / 3 : dx);
  };
  const onPointerEnd = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    setDrag(0);
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    go(dx < 0 ? index + 1 : index - 1);
  };

  const dot = (on: boolean) => (
    <span
      className="block rounded-full"
      style={{
        width: on ? 22 : 9,
        height: 9,
        background: on ? CLASSIC_ACCENT : alphaHex(CLASSIC_ACCENT, 0.28),
        // AZ: no width animation (layout per frame) — the pill swaps size, only its color eases.
        transition: reduced ? 'none' : 'background-color 220ms cubic-bezier(0.22, 0.8, 0.3, 1)',
      }}
    />
  );

  const steps = replay ? STEPS.slice(0, 2) : STEPS;
  const signedInReady = !!user && !!p;

  return (
    <>
      {authModal}
      <div
        ref={rootRef}
        className={`fixed inset-0 ${authOpen ? 'z-[49]' : 'z-[85]'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Wordocious"
      >
        <PageBackground tint="home" className="relative w-full h-full flex flex-col overflow-hidden" style={{ paddingTop: 'max(14px, env(safe-area-inset-top, 0px))', paddingBottom: 'max(18px, env(safe-area-inset-bottom, 0px))' }}>
          {/* Skip, top right (steps 2–4). */}
          <div className="flex justify-end px-4" style={{ flex: 'none', minHeight: 40 }}>
            {showSkip && <CandyButton size="sm" color="peach" onClick={skip}>Skip</CandyButton>}
          </div>

          {/* 1. WELCOME */}
          {step === 'welcome' && (
            <StepIn reduced={reduced} className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-5 mx-auto w-full" key="welcome">
              {welcomeArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={artSrc('art-scene-welcome-cast')} alt="" aria-hidden draggable={false} className="block select-none pointer-events-none" style={{ width: '100%', maxWidth: 520, height: 'auto', maxHeight: '38vh', objectFit: 'contain' }} />
              ) : (
                <div className="w-full" style={{ maxWidth: 440 }} aria-hidden="true"><CastHeader /></div>
              )}
              <Headline>WELCOME TO WORDOCIOUS!</Headline>
              <Line>Daily word games, a cast of friends, and bragging rights.</Line>
              <CandyButton size="lg" color="purple" icon="arrow" onClick={() => goStep('tour')} className="mt-2" style={{ minWidth: 220 }}>
                Let&apos;s go!
              </CandyButton>
              {!replay && !user && <TextLink onClick={haveAccount}>I already have an account</TextLink>}
            </StepIn>
          )}

          {/* 2. QUICK TOUR: a sliding track (Reduce Motion: stacked, crossfading). */}
          {step === 'tour' && (
            <div
              className="relative flex-1 min-h-0 overflow-hidden"
              style={{ touchAction: 'pan-y' }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerEnd}
              onPointerCancel={onPointerEnd}
            >
              <span className="sr-only" aria-live="polite">{`Card ${index + 1} of ${CARDS.length}: ${CARDS[index].title}`}</span>
              {reduced ? (
                CARDS.map((c, i) => (
                  <div key={c.art} className="absolute inset-0" style={{ opacity: i === index ? 1 : 0, transition: 'opacity 200ms ease', pointerEvents: i === index ? 'auto' : 'none' }}>
                    <TourCard card={c} index={i} active={i === index} artRef={(el) => { artRefs.current[i] = el; }} />
                  </div>
                ))
              ) : (
                <div
                  className="flex h-full"
                  style={{
                    width: `${CARDS.length * 100}%`,
                    transform: `translateX(calc(${(-index * 100) / CARDS.length}% + ${drag}px))`,
                    transition: drag !== 0 ? 'none' : 'transform 380ms cubic-bezier(0.22, 0.8, 0.3, 1)', willChange: 'transform',
                  }}
                >
                  {CARDS.map((c, i) => (
                    <div key={c.art} className="h-full" style={{ width: `${100 / CARDS.length}%` }}>
                      <TourCard card={c} index={i} active={i === index} artRef={(el) => { artRefs.current[i] = el; }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3. MAKE YOUR PROFILE */}
          {step === 'profile' && (
            <StepIn reduced={reduced} className="flex-1 min-h-0 overflow-y-auto flex flex-col items-center justify-center gap-4 px-5 mx-auto w-full" key="profile">
              <div className="w-full flex flex-col items-center gap-4" style={{ maxWidth: 400 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={artSrc('art-pose-w-wave')} alt="" aria-hidden width={120} height={120} draggable={false} style={{ width: 120, height: 120 }} />
                <Headline>MAKE YOUR PROFILE</Headline>
                {signedInReady ? (
                  <UsernameStep profileId={p!.id} current={String(p!.username ?? '')} refreshProfile={refreshProfile} onSaved={() => goStep('mascot')} />
                ) : user ? (
                  <Line>Setting up your profile...</Line>
                ) : (
                  <>
                    <Line>Save your streaks and stats, play on any device, and climb the leaderboards.</Line>
                    {authNote && (
                      <p className="m-0 text-center text-[13px] font-bold px-3 py-2" style={softNotice('info')}>
                        Just signed up? Tap the link in the email we sent, and we&apos;ll pick up right here.
                      </p>
                    )}
                    <CandyButton size="lg" color="purple" icon="plus" onClick={createAccount} style={{ minWidth: 240 }}>
                      Create my account
                    </CandyButton>
                    <TextLink onClick={playAsGuest}>Play as guest</TextLink>
                  </>
                )}
              </div>
            </StepIn>
          )}

          {/* 4. MAKE YOUR MASCOT: the AN builder, W coaching. */}
          {step === 'mascot' && (
            <StepIn reduced={reduced} className="flex-1 min-h-0 flex flex-col" key="mascot">
              <div ref={builderRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-4">
                <div className="mx-auto w-full flex flex-col items-center gap-3" style={{ maxWidth: 440 }}>
                  <Headline>MAKE YOUR MASCOT</Headline>
                  {draft && p ? (
                    <div className="w-full">
                      <MascotBuilder
                        value={draft}
                        onChange={setDraft}
                        initial={look.initial}
                        isPro={isProActive}
                        level={Number(p.level) || 1}
                        saving={avatarSaving}
                        onBack={() => goStep('profile')}
                        onSave={(c) => void saveMascot(c)}
                      />
                      {avatarNote && <p className="text-xs font-bold mt-2" style={{ color: 'var(--color-loss-text)' }}>{avatarNote}</p>}
                    </div>
                  ) : (
                    <Line>Loading your mascot...</Line>
                  )}
                  <TextLink onClick={() => goStep('done')}>Do it later</TextLink>
                </div>
              </div>
            </StepIn>
          )}

          {/* 5. ALL SET */}
          {step === 'done' && (
            <StepIn reduced={reduced} className="flex-1 min-h-0 flex flex-col items-center justify-center gap-4 px-5 mx-auto w-full" key="done">
              <Confetti colors={CANDY_CONFETTI.purple} />
              {allSetArt ? (
                <div className="relative w-full flex justify-center" style={{ maxWidth: 520 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artSrc('art-scene-all-set')} alt="" aria-hidden draggable={false} className="block select-none pointer-events-none" style={{ width: '100%', height: 'auto', maxHeight: '38vh', objectFit: 'contain' }} />
                  {p && (
                    <span className="absolute left-1/2 bottom-0 -translate-x-1/2" aria-hidden="true">
                      <CastWithYouSolo config={look.config} initial={look.initial} reduced={reduced} />
                    </span>
                  )}
                </div>
              ) : (
                <CastWithYou you={p ? look.config : null} initial={look.initial} reduced={reduced} />
              )}
              <Headline>YOU&apos;RE IN!</Headline>
              <Line>Meet the gang. Your first puzzle is ready.</Line>
              <CandyButton size="lg" color="purple" icon="play" onClick={() => finish(playHref)} className="mt-2" style={{ minWidth: 240 }}>
                Play today&apos;s Classic
              </CandyButton>
              <TextLink onClick={() => finish()}>Explore first</TextLink>
            </StepIn>
          )}

          {/* Page dots + the tour's Next. */}
          <div className="flex flex-col items-center gap-3 px-5 pt-2" style={{ flex: 'none' }}>
            {step === 'tour' ? (
              <>
                <div className="flex items-center gap-2" role="group" aria-label="Cards">
                  {CARDS.map((c, i) => (
                    <button key={c.art} type="button" aria-current={i === index ? 'step' : undefined} aria-label={`Card ${i + 1} of ${CARDS.length}`} onClick={() => go(i)} className="p-1.5" style={{ background: 'transparent', border: 0 }}>
                      {dot(i === index)}
                    </button>
                  ))}
                </div>
                {!lastCard ? (
                  <CandyButton size="lg" color="purple" icon="arrow" onClick={() => go(index + 1)} style={{ minWidth: 200 }}>Next</CandyButton>
                ) : replay ? (
                  <CandyButton size="lg" color="purple" icon="check" onClick={close} style={{ minWidth: 200 }}>Got it</CandyButton>
                ) : (
                  <CandyButton size="lg" color="purple" icon="arrow" onClick={() => goStep('profile')} style={{ minWidth: 200 }}>Next</CandyButton>
                )}
              </>
            ) : step !== 'mascot' ? (
              <div className="flex items-center gap-2 py-1.5" role="img" aria-label={`Step ${steps.indexOf(step) + 1} of ${steps.length}`}>
                {steps.map((s) => <span key={s}>{dot(s === step)}</span>)}
              </div>
            ) : null}
          </div>
        </PageBackground>

        {/* W's tips over the builder (tap to advance). */}
        {step === 'mascot' && coach && draft && (
          <MascotCoach rootRef={builderRef} reduced={reduced} onDone={() => setCoach(false)} />
        )}
      </div>
    </>
  );
}

/** The player's mascot hopping in under the ALL SET scene. */
function CastWithYouSolo({ config, initial, reduced }: { config: AvatarConfig; initial: string; reduced: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      feedback('hop');
      const el = ref.current;
      if (!el || reduced || typeof el.animate !== 'function') return;
      el.animate(
        [
          { transform: 'translateY(-80px) scale(0.5)', opacity: 0 },
          { transform: 'translateY(4px) scale(1.08, 0.9)', opacity: 1, offset: 0.7 },
          { transform: 'translateY(0) scale(1)', opacity: 1 },
        ],
        { duration: 680, easing: 'cubic-bezier(0.3, 1.2, 0.5, 1)', fill: 'backwards' },
      );
    }, 250);
    return () => clearTimeout(t);
  }, [reduced]);
  return (
    <span ref={ref} className="inline-block" style={{ transformOrigin: '50% 100%' }}>
      <MascotAvatar config={config} initial={initial} size={72} />
    </span>
  );
}
