'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { ArtTitle } from '@/components/ui/art-title';
import { CandyButton } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { HelpExample } from '@/components/help/help-example';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { GAME_TITLE_ART_HEIGHT, gameTitleArtForGuide, gameTitleArtLabel, poseSrc } from '@/lib/art';
import { getGuide } from '@/lib/guide-content';
import { helpSteps } from '@/lib/help-steps';
import { CAST, guideHost } from '@/lib/mascots';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback } from '@/lib/sound-events';
import { SOFT_INK, alphaHex, darken, softMix } from '@/lib/soft-surface';

// The in-game "?" help card (docs/FINISH_SPEC.md AF) in the R1 card language
// (components/effects/result-popup.tsx): the game's host in its ready pose on a
// stage (glow, slow rays, ground shadow, spring-in, bob) above a soft
// accent-gradient card with the rainbow top bar; the game's title art; 3–4
// short steps, each with a tiny example row of the real glossy tiles turning
// over; a candy "Got it" in the game accent; "Take the tour" (the first-run
// tour replay, /?tour=1); and the full rules, scoring and strategy one tap away
// under "Scoring & strategy". Opens with a `whoosh`. Escape, the X, a backdrop
// tap or Got it close it; focus is trapped inside while it is open. Reduce
// Motion: static tiles, no rays / bob / spring / pops (globals.css `.rp-*`).

interface Props {
  /** Guide slug (lib/guide-content.ts): classic, six, quadword, … */
  slug: string;
  accent: string;
  onClose: () => void;
}

/** When the first step's tiles start turning (after the card springs in), and the gap between steps. */
const FIRST_FLIP_MS = 450;
const STEP_GAP_MS = 650;

export function GameHelpCard({ slug, accent, onClose }: Props) {
  const guide = getGuide(slug);
  const help = helpSteps(slug);
  // A7: the title art already draws the game's host, so the stage holds the
  // NEXT cast member (never the same character twice on the card).
  const gameHost = guideHost(slug);
  const host = gameHost ? CAST[(CAST.indexOf(gameHost) + 1) % CAST.length] : 'w';
  const titleArt = gameTitleArtForGuide(slug);
  const [still] = useState(() => prefersReducedMotion());
  // Tapping an example replays it (a fresh key re-mounts its tiles, no stagger).
  const [replays, setReplays] = useState<number[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true);

  useEffect(() => {
    feedback('whoosh');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!guide || !help) return null;

  const deep = darken(accent, 0.35);
  const candyAccent = { ['--candy-1' as string]: softMix(accent, 0.62), ['--candy-2' as string]: accent, ['--candy-lip' as string]: deep } as React.CSSProperties;
  const titleId = `help-title-${slug}`;
  const tray = { background: alphaHex(accent, 0.08), borderRadius: 16 } as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      style={{ backgroundColor: 'rgba(30, 15, 60, 0.55)' }}
      onClick={onClose}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-w-sm w-full soft-pop"
        style={{ marginTop: 64 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* The host's stage: glow, slow rays, ground shadow; spring-in, then a bob. */}
        <div className="absolute left-0 right-0 flex justify-center pointer-events-none" style={{ top: -78, zIndex: 2 }} aria-hidden="true">
          <div className="relative" style={{ width: 150, height: 108 }}>
            <span className="absolute rp-rays" style={{ left: '50%', top: '46%', width: 190, height: 190, marginLeft: -95, marginTop: -95, borderRadius: '50%', background: `repeating-conic-gradient(${alphaHex(accent, 0.12)} 0deg 10deg, transparent 10deg 24deg)`, maskImage: 'radial-gradient(circle, #000 30%, transparent 70%)', WebkitMaskImage: 'radial-gradient(circle, #000 30%, transparent 70%)' }} />
            <span className="absolute" style={{ left: '50%', top: '46%', width: 120, height: 120, marginLeft: -60, marginTop: -60, borderRadius: '50%', background: `radial-gradient(circle, ${alphaHex(accent, 0.3)}, transparent 68%)` }} />
            <span className="absolute" style={{ left: '50%', bottom: 2, width: 70, height: 10, marginLeft: -35, borderRadius: '50%', background: alphaHex(deep, 0.22), filter: 'blur(3px)' }} />
            <div className="absolute rp-spring" style={{ left: '50%', bottom: 2, marginLeft: -50 }}>
              <div className="rp-bob">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={poseSrc(host, 'ready')} alt="" width={100} height={100} draggable={false} className="block select-none" style={{ width: 100, height: 100 }} />
              </div>
            </div>
          </div>
        </div>

        <div
          className="help-pop relative overflow-hidden flex flex-col"
          style={{
            background: `linear-gradient(${alphaHex(accent, 0.1)}, ${alphaHex(accent, 0.04)}), var(--popup-cream)`,
            borderRadius: 28,
            boxShadow: `0 24px 60px rgba(40, 15, 80, 0.3), 0 0 0 1.5px ${alphaHex(accent, 0.22)}, 0 0 36px ${alphaHex(accent, 0.28)}`,
            maxHeight: 'calc(100dvh - 88px)',
          }}
        >
          <div aria-hidden="true" style={{ height: 10, background: BRAND_BAR, flex: 'none' }} />
          <div className="absolute right-3 top-4" style={{ zIndex: 3 }}>
            <HeaderBack kind="close" onClick={onClose} size={32} />
          </div>

          <div className="px-5 pt-8 pb-5 overflow-y-auto">
            {titleArt ? (
              <div id={titleId}>
                <ArtTitle name={titleArt} label={gameTitleArtLabel(titleArt)} maxHeight={GAME_TITLE_ART_HEIGHT.guide} maxWidth={2000} as="h2" />
              </div>
            ) : (
              <h2 id={titleId} className="text-2xl font-black uppercase tracking-wide text-center" style={{ color: 'var(--color-text)' }}>
                {help.title}
              </h2>
            )}
            <p className="text-[11px] font-black uppercase text-center mt-1.5" style={{ letterSpacing: '0.12em', color: SOFT_INK.label }}>
              How to play
            </p>

            <ol className="mt-3 space-y-2">
              {help.steps.map((step, i) => {
                const replay = replays[i] ?? 0;
                return (
                  <li key={i} className="flex gap-3 px-3 py-2.5" style={tray}>
                    <span
                      aria-hidden="true"
                      className="flex-none inline-flex items-center justify-center rounded-full text-[13px] font-black text-white"
                      style={{ width: 24, height: 24, background: `linear-gradient(${softMix(accent, 0.7)}, ${accent})`, boxShadow: `inset 0 -2px 0 ${deep}`, textShadow: '0 1px 1px rgba(0, 0, 0, 0.25)' }}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold leading-snug" style={{ color: 'var(--color-text)' }}>{step.text}</p>
                      <div
                        className="mt-2"
                        onClick={still ? undefined : () => setReplays((r) => { const next = [...r]; next[i] = (next[i] ?? 0) + 1; return next; })}
                      >
                        <HelpExample
                          key={replay}
                          example={step.example}
                          accent={accent}
                          delay={replay > 0 ? 0 : FIRST_FLIP_MS + i * STEP_GAP_MS}
                          still={still}
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-4 flex flex-col items-center gap-2.5">
              <CandyButton size="md" style={candyAccent} icon="check" onClick={onClose}>
                Got it
              </CandyButton>
              <Link
                href="/?tour=1"
                onClick={onClose}
                className="text-xs font-black underline underline-offset-2"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Take the tour
              </Link>
            </div>

            {/* The full guide (rules, scoring, strategy) the sheet used to show, one tap away. */}
            <details className="mt-4 group" style={tray}>
              <summary className="flex items-center justify-between gap-2 px-4 py-3 cursor-pointer list-none text-sm font-black" style={{ color: 'var(--color-text)' }}>
                Scoring &amp; strategy
                <ChevronDown aria-hidden="true" className="transition-transform group-open:rotate-180" style={{ width: 18, height: 18, color: 'var(--color-text-muted)' }} />
              </summary>
              <div className="px-4 pb-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  {guide.facts.map((f) => (
                    <div key={f.label} className="px-3 py-2" style={{ background: alphaHex(accent, 0.08), borderRadius: 12 }}>
                      <div className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{f.label}</div>
                      <div className="text-xs font-black mt-0.5" style={{ color: 'var(--color-text)' }}>{f.value}</div>
                    </div>
                  ))}
                </div>
                <section>
                  <h3 className="text-sm font-black mb-1.5" style={{ color: 'var(--color-text)' }}>How it works</h3>
                  {guide.rules.map((p, i) => (
                    <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
                  ))}
                </section>
                <section>
                  <h3 className="text-sm font-black mb-1.5" style={{ color: 'var(--color-text)' }}>How scoring works</h3>
                  {guide.scoring.map((p, i) => (
                    <p key={i} className="text-xs leading-relaxed mb-2 last:mb-0" style={{ color: 'var(--color-text-secondary)' }}>{p}</p>
                  ))}
                </section>
                <section>
                  <h3 className="text-sm font-black mb-1.5" style={{ color: 'var(--color-text)' }}>Strategy</h3>
                  <div className="space-y-3">
                    {guide.tips.map((tip) => (
                      <div key={tip.heading}>
                        <h4 className="text-xs font-black mb-0.5" style={{ color: 'var(--color-text)' }}>{tip.heading}</h4>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{tip.body}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
}
