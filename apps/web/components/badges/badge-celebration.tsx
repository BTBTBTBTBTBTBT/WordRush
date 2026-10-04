'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { HeadingArt } from '@/components/ui/heading-art';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { ART_SIZE, artSrc, badgeSrc, poseArt } from '@/lib/art';
import { ACHIEVEMENTS } from '@/lib/achievement-service';
import { seenCount } from '@/lib/achievement-seen';
import { shareAchievementCard } from '@/lib/achievement-share';
import { viewUrl, VIEW_ALL } from '@/lib/stats-view';
import { Confetti } from '@/components/effects/confetti';
import { CandyButton } from '@/components/ui/candy-button';
import { CastButton } from '@/components/ui/cast-button';
import { SoftNum } from '@/components/ui/soft-number';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { BadgeArt } from './badge-art';
import { levelTierLabel } from '@wordle-duel/core';
import { type BadgeCelebration } from '@/lib/badges';
import { alphaHex, darken } from '@/lib/soft-surface';
import { useDecodedEntrance } from '@/hooks/use-decoded-entrance';

// The unlock moment (docs/FINISH_SPEC.md V2, and the V3 new-tier popup) in the
// R1 card language: the accent's soft gradient over the warm cream (a deep
// accent tint in dark mode — globals.css `.badge-pop`), the rainbow top bar,
// the big badge springing in on a stage of slow rays + glow, one confetti
// burst, "ACHIEVEMENT UNLOCKED" in lettering-style ink, the name and the
// story, and a candy "Nice!". Reduce Motion: no rays, spring, bob or confetti
// (the shared `.rp-*` rules).
// FINISH_SPEC BF2: a mascot pair presents the badge (art-scene-achievement
// when it ships; until then two cast poses flank it), the badge is the
// achievement's own art-ach-<key> (falling back to its category icon),
// "ACHIEVEMENT UNLOCKED!" is gold live lettering, then the NAME, the PURPOSE
// line (its description), an XP chip when it pays XP, "N of M unlocked", and
// candy "Awesome!" + "See all" (→ Stats, All-time achievements) + share.

const SCENE = 'art-scene-achievement';
const has = (name: string): boolean => name in (ART_SIZE as Record<string, unknown>);
const SIDE_POSES = [poseArt('o1', 'cheer'), poseArt('w', 'proud')] as const;

const CONFETTI = ['#7c3aed', '#f97316', '#22c55e', '#2563eb', '#ec4899', '#0ea5e9', '#f5c542', '#ef4444'];

export function BadgeCelebrationPopup({ item, remaining, onClose }: {
  item: BadgeCelebration;
  /** How many more are waiting after this one. */
  remaining: number;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const accent = item.accent;
  const deep = darken(accent, 0.35);
  const isTier = item.kind === 'tier';
  const headline = isTier ? 'New tier!' : 'Achievement unlocked';
  const title = isTier ? `${levelTierLabel(item.tier)} tier` : item.name;
  const badge = isTier ? (`level-${item.tier}` as const) : item.badge;
  const ownArt = !isTier && has(`art-ach-${item.key}`) ? `art-ach-${item.key}` : null;
  const router = useRouter();
  const [shareNote, setShareNote] = useState<string | null>(null);
  const total = ACHIEVEMENTS.length;
  const have = isTier ? null : seenCount();
  // AZ: the badge + host art are decoded before the spring-in starts.
  const { ref: entranceRef, waiting } = useDecodedEntrance<HTMLDivElement>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  // Focus once the card is visible (a held first frame can't take focus).
  useEffect(() => { if (!waiting) ref.current?.focus(); }, [waiting]);

  return (
    <div
      ref={entranceRef}
      className={`fixed inset-0 z-[65] flex items-center justify-center px-5 animate-fade-in${waiting ? ' motion-wait' : ''}`}
      style={{ backgroundColor: 'rgba(30, 15, 60, 0.55)' }}
      onClick={onClose}
    >
      <Confetti colors={CONFETTI} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`${headline}: ${title}`}
        tabIndex={-1}
        className="badge-pop relative max-w-sm w-full overflow-hidden text-center outline-none animate-fade-in-scale"
        style={{
          background: `linear-gradient(${alphaHex(accent, 0.1)}, ${alphaHex(accent, 0.04)}), var(--popup-cream)`,
          borderRadius: 28,
          boxShadow: `0 24px 60px rgba(40, 15, 80, 0.3), 0 0 0 1.5px ${alphaHex(accent, 0.22)}, 0 0 36px ${alphaHex(accent, 0.28)}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div aria-hidden="true" style={{ height: 10, background: BRAND_BAR }} />
        <div className="px-5 pt-4 pb-5 flex flex-col items-center">
          {/* The stage: slow rays + a glow + a ground shadow; the badge springs in, then bobs. */}
          <div className="relative" style={{ width: 200, height: 176 }} aria-hidden="true">
            <span
              className="absolute rp-rays"
              style={{
                left: '50%', top: '48%', width: 230, height: 230, marginLeft: -115, marginTop: -115, borderRadius: '50%',
                background: `repeating-conic-gradient(${alphaHex(accent, 0.16)} 0deg 10deg, transparent 10deg 24deg)`,
                maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
                WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)',
              }}
            />
            <span className="absolute" style={{ left: '50%', top: '48%', width: 150, height: 150, marginLeft: -75, marginTop: -75, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(accent, 0.34)}, transparent 68%)` }} />
            <span className="absolute" style={{ left: '50%', bottom: 4, width: 84, height: 12, marginLeft: -42, borderRadius: '50%', background: alphaHex(deep, 0.22), filter: 'blur(3px)' }} />
            {/* BF2: the mascot pair presenting the badge (the scene art when it ships; two cast poses until then). */}
            {!isTier && (has(SCENE) ? (
              <Image src={artSrc(SCENE)} alt="" aria-hidden width={(ART_SIZE as any)[SCENE][0]} height={(ART_SIZE as any)[SCENE][1]} priority
                className="absolute rp-spring pointer-events-none select-none" style={{ left: -40, right: -40, bottom: 0, width: 'calc(100% + 80px)', height: 'auto' }} />
            ) : (
              <>
                <Image src={artSrc(SIDE_POSES[0])} alt="" aria-hidden width={320} height={320} priority className="absolute intro-pop pointer-events-none select-none" style={{ left: -54, bottom: 0, width: 92, height: 92 }} />
                <Image src={artSrc(SIDE_POSES[1])} alt="" aria-hidden width={320} height={320} priority className="absolute intro-pop pointer-events-none select-none" style={{ right: -54, bottom: 0, width: 92, height: 92, animationDelay: '120ms' }} />
              </>
            ))}
            <div className="absolute rp-spring" style={{ left: '50%', bottom: 10, marginLeft: -76 }}>
              <div className="rp-bob">
                {ownArt ? (
                  <Image src={artSrc(ownArt)} alt="" aria-hidden width={152} height={152} priority style={{ width: 152, height: 152, objectFit: 'contain', filter: `drop-shadow(0 0 16px ${alphaHex(accent, 0.45)}) drop-shadow(0 6px 8px rgba(59, 26, 120, 0.22))` }} />
                ) : (
                  <BadgeArt name={badge} size={152} priority style={{ filter: `drop-shadow(0 0 16px ${alphaHex(accent, 0.45)}) drop-shadow(0 6px 8px rgba(59, 26, 120, 0.22))` }} />
                )}
              </div>
            </div>
          </div>

          {isTier ? (
            <div className="relative rp-gloss mt-1" style={{ width: 'fit-content', maxWidth: '100%' }}>
              <div className="badge-lettering" style={{ fontSize: 30 }}>{headline}</div>
            </div>
          ) : (
            <HeadingArt slug="achievement" height={44} className="mt-1" />
          )}

          <h2 className="m-0 mt-2 soft-num soft-num-auto leading-tight" style={{ fontSize: 26 }}>{title}</h2>
          {isTier ? (
            <p className="m-0 mt-1 text-[13.5px] font-bold inline-flex items-baseline gap-1" style={{ color: 'var(--color-text-muted)' }}>
              You reached Level <SoftNum size={16} className="soft-num-auto">{item.level}</SoftNum>
            </p>
          ) : (
            <p className="m-0 mt-1 text-[13.5px] font-bold" style={{ color: 'var(--color-text-muted)' }}>{item.description}</p>
          )}

          {!isTier && (item.xp || have != null) && (
            <div className="mt-2 flex items-center justify-center gap-2 flex-wrap">
              {item.xp ? (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-black text-[12px]" style={{ background: 'linear-gradient(#fff1a8, #f5c542)', color: '#7c2d12', boxShadow: '0 2px 0 #c58a1a' }}>
                  +<SoftNum size={13}>{item.xp}</SoftNum> XP
                </span>
              ) : null}
              {have != null && (
                <span className="text-[12px] font-black inline-flex items-baseline gap-1" style={{ color: 'var(--color-text-muted)' }}>
                  <SoftNum size={13} className="soft-num-auto">{Math.min(have, total)}</SoftNum> of <SoftNum size={13} className="soft-num-auto">{total}</SoftNum> unlocked
                </span>
              )}
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-2">
            <CastButton size="md" color="purple" onClick={onClose}>{isTier ? 'Nice!' : 'Awesome!'}</CastButton>
            {!isTier && (
              <>
                <CandyButton size="md" color="peach" onClick={() => { onClose(); router.push(viewUrl(VIEW_ALL)); }}>See all</CandyButton>
                <HeaderGlyph
                  icon="share"
                  label="Share this achievement"
                  onClick={async () => {
                    const r = await shareAchievementCard({ name: item.name, description: item.description, badgeSrcs: [ownArt ? artSrc(ownArt) : badgeSrc(item.badge)], accent });
                    setShareNote(r === 'copied' ? 'Copied!' : r === 'failed' ? 'Could not share' : null);
                  }}
                />
              </>
            )}
          </div>
          {shareNote && <div className="mt-1 text-[11px] font-black" style={{ color: 'var(--color-text-muted)' }}>{shareNote}</div>}
          {remaining > 0 && (
            <div className="mt-2 text-[11px] font-black inline-flex items-baseline gap-1" style={{ color: 'var(--color-text-muted)' }}>
              <SoftNum size={12} className="soft-num-auto">{remaining}</SoftNum> more
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
