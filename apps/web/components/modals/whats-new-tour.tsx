'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { WHATS_NEW_FLAG, WHATS_NEW_KEY, whatsNewDecision, whatsNewPages, type WhatsNewPage } from '@wordle-duel/core';
import { BubbleText } from '@/components/ui/bubble-text';
import { CandyButton } from '@/components/ui/candy-button';
import { TextLink as FamilyTextLink } from '@/components/ui/cast-button';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { OwnMascot } from '@/components/leaderboard/leaderboard-stage';
import { useAuth } from '@/lib/auth-context';
import { useFlags } from '@/hooks/use-flags';
import { useTutorialsSeen } from '@/lib/tutorials-seen';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { ART_SIZE, artSrc, gameArtSrc, type ArtName } from '@/lib/art';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback } from '@/lib/sound-events';
import { INTRO_RUNNING_ATTR } from '@/lib/intro';

// FRIDAY-QUEUE item 41: the one-time "What's new in 2.8" tour for players who update (never brand-new ones).
// Six short pages, each a bubble-lettered title over a framed illustration (the tutorial frames from art/driver,
// `art-tut-frame`), two plain lines, page dots, Next, and Skip on every page. The decision + the words are core
// (whats-new.ts); "seen" is the synced tutorials list (key `whats-new-28`). Gate: the `whats_new_28` off-switch.
// iOS: WhatsNewTour.swift · Android: WhatsNewTour.kt.

const PALETTES = ['leaderboard', 'home', 'menu', 'friends', 'stats', 'celebrate'] as const;

function PageArt({ page }: { page: WhatsNewPage }) {
  const art = page.art;
  if (art.kind === 'mascot') return <OwnMascot size={150} />;
  if (art.kind === 'art') {
    const name = art.name as ArtName;
    const size = ART_SIZE[name];
    const h = 140;
    const w = size ? Math.round((h * size[0]) / size[1]) : h;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={artSrc(name)} alt="" aria-hidden width={w} height={h} draggable={false} style={{ width: w, height: h, objectFit: 'contain' }} />;
  }
  return (
    <div className="flex items-center justify-center gap-3">
      {art.names.map((n) => {
        const id = n.replace(/^game-/, '');
        const src = gameArtSrc(id) ?? artSrc(n);
        const s = art.names.length === 1 ? 120 : 84;
        // eslint-disable-next-line @next/next/no-img-element
        return <img key={n} src={src} alt="" aria-hidden width={s} height={s} draggable={false} style={{ width: s, height: s, objectFit: 'contain' }} />;
      })}
    </div>
  );
}

export function WhatsNewTour() {
  const { user, profile, loading } = useAuth();
  const { isLive } = useFlags();
  const { seen, mark } = useTutorialsSeen();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pages = whatsNewPages('web');
  useFocusTrap(rootRef, open);

  // Decide: only on Home, once the cold-start intro is done, and never on a guess.
  useEffect(() => {
    if (open || loading || pathname !== '/') return;
    const p = profile as { has_onboarded?: boolean | null; created_at?: string | null } | null;
    const decision = whatsNewDecision({
      live: isLive(WHATS_NEW_FLAG),
      seen,
      signedIn: !!user,
      hasOnboarded: user ? (p ? !!p.has_onboarded : null) : false,
      createdAt: p?.created_at ?? null,
    });
    if (decision === 'record') { mark(WHATS_NEW_KEY); return; }
    if (decision !== 'show') return;
    const t = setTimeout(() => {
      if (document.documentElement.hasAttribute(INTRO_RUNNING_ATTR)) return;
      setReduced(prefersReducedMotion());
      setIndex(0);
      setOpen(true);
      feedback('whoosh');
    }, 1400);
    return () => clearTimeout(t);
  }, [open, loading, pathname, isLive, seen, user, profile, mark]);

  const close = useCallback(() => {
    setOpen(false);
    mark(WHATS_NEW_KEY);
  }, [mark]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  if (!open || pages.length === 0) return null;
  const page = pages[index];
  const last = index === pages.length - 1;
  const next = () => { if (last) close(); else { setIndex(index + 1); feedback('whoosh'); } };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 animate-fade-in" style={{ backgroundColor: 'rgba(30, 15, 60, 0.6)' }}>
      <div
        ref={rootRef}
        role="dialog"
        aria-modal="true"
        aria-label="What's new in Wordocious 2.8"
        className="relative w-full soft-pop overflow-hidden flex flex-col items-center"
        style={{ maxWidth: 380, background: 'var(--popup-cream)', borderRadius: 28, boxShadow: '0 24px 60px rgba(40, 15, 80, 0.35)' }}
      >
        <div aria-hidden="true" className="w-full" style={{ height: 10, background: BRAND_BAR }} />
        <div className="w-full flex flex-col items-center gap-3 px-5 pt-4 pb-5" key={page.id}>
          <p className="m-0 text-[11px] font-black uppercase" style={{ letterSpacing: '0.14em', color: 'var(--color-text-muted)' }}>
            New in 2.8
          </p>
          <BubbleText text={page.title} palette={PALETTES[index % PALETTES.length]} maxSize={28} minSize={18} level={2} className="w-full" />
          {/* the framed illustration (the art/driver tutorial frame behind it) */}
          <div
            className="relative flex items-center justify-center"
            style={{ width: 240, height: 246, backgroundImage: `url(${artSrc('art-tut-frame')})`, backgroundSize: '100% 100%' }}
          >
            <div className={reduced ? '' : 'rp-spring'}><PageArt page={page} /></div>
          </div>
          <div className="flex flex-col gap-1.5">
            {page.lines.map((l, i) => (
              <p key={i} className="m-0 text-center text-[15px] font-bold leading-snug" style={{ color: 'var(--color-text-secondary)' }}>{l}</p>
            ))}
          </div>
          {/* page dots: gold = this page */}
          <div className="flex items-center justify-center gap-2" role="presentation" aria-hidden="true">
            {pages.map((p, i) => (
              <Image key={p.id} src={artSrc(i === index ? 'art-tut-dot-on' : 'art-tut-dot-off')} alt="" width={14} height={14} draggable={false} style={{ width: 14, height: 14 }} />
            ))}
          </div>
          <div className="flex flex-col items-center gap-1.5 mt-1">
            <CandyButton size="md" color="purple" icon={last ? 'check' : 'arrow'} onClick={next}>{last ? "Let's go!" : 'Next'}</CandyButton>
            {!last && <FamilyTextLink onClick={close} className="px-2 py-1">Skip</FamilyTextLink>}
          </div>
        </div>
      </div>
    </div>
  );
}
