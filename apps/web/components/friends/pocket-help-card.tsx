'use client';

// The pocket games' How to Play card (FRIDAY-QUEUE items 9c + 12): the same card language as the other
// games' "?" (components/help/game-help-card.tsx) — the game's title art, three short numbered steps each
// with a tiny picture of the real pieces (art-pocket-*), the win rule and how turns work with a friend,
// and a candy button ("Let's play!" the first time, "Got it" after). The content is core (pocket-help.ts)
// so iOS and Android say the same words. Reduce Motion: the pictures sit still (no pop-in).
// iOS: PocketHelpSheet.swift · Android: PocketHelpSheet.kt.

import { useEffect, useRef } from 'react';
import { POCKET_HELP, TUTORIAL_BUTTON_AGAIN, TUTORIAL_BUTTON_FIRST, type FriendlyKind } from '@wordle-duel/core';
import { ArtTitle } from '@/components/ui/art-title';
import { CandyButton } from '@/components/ui/candy-button';
import { HeaderBack } from '@/components/ui/page-header';
import { BRAND_BAR } from '@/components/ui/soft-popup';
import { useFocusTrap } from '@/hooks/use-focus-trap';
import { ART_SIZE, artSrc, type ArtName } from '@/lib/art';
import { KIND_COLOR, pocketTitleArt } from '@/lib/friends-play';
import { prefersReducedMotion } from '@/lib/motion';
import { feedback } from '@/lib/sound-events';
import { SOFT_INK, alphaHex, darken, softMix } from '@/lib/soft-surface';

const PIECE_H = 46;

function Piece({ name }: { name: string }) {
  const size = ART_SIZE[name as ArtName];
  const w = size ? Math.round((PIECE_H * size[0]) / size[1]) : PIECE_H;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(name)} alt="" width={w} height={PIECE_H} draggable={false} loading="lazy" decoding="async" style={{ width: w, height: PIECE_H, objectFit: 'contain' }} />;
}

export function PocketHelpCard({ kind, onClose, firstPlay = false }: { kind: FriendlyKind; onClose: () => void; firstPlay?: boolean }) {
  const help = POCKET_HELP[kind];
  const accent = KIND_COLOR[kind];
  const deep = darken(accent, 0.35);
  const still = prefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  useFocusTrap(cardRef, true);
  const titleArt = pocketTitleArt(kind);
  const tray = { background: alphaHex(accent, 0.08), borderRadius: 16 } as const;

  useEffect(() => { feedback('whoosh'); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onClose(); } };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const candyAccent = { ['--candy-1' as string]: softMix(accent, 0.62), ['--candy-2' as string]: accent, ['--candy-lip' as string]: deep } as React.CSSProperties;
  const titleId = `pocket-help-${kind}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in" style={{ backgroundColor: 'rgba(30, 15, 60, 0.55)' }} onClick={onClose}>
      <div ref={cardRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative max-w-sm w-full soft-pop" onClick={(e) => e.stopPropagation()}>
        <div
          className="relative overflow-hidden flex flex-col"
          style={{
            background: `linear-gradient(${alphaHex(accent, 0.1)}, ${alphaHex(accent, 0.04)}), var(--popup-cream)`,
            borderRadius: 28,
            boxShadow: `0 24px 60px rgba(40, 15, 80, 0.3), 0 0 0 1.5px ${alphaHex(accent, 0.22)}, 0 0 36px ${alphaHex(accent, 0.28)}`,
            maxHeight: 'calc(100dvh - 48px)',
          }}
        >
          <div aria-hidden="true" style={{ height: 10, background: BRAND_BAR, flex: 'none' }} />
          <div className="absolute right-3 top-4" style={{ zIndex: 3 }}><HeaderBack kind="close" onClick={onClose} size={32} /></div>
          <div className="px-5 pt-6 pb-5 overflow-y-auto">
            <div id={titleId}>
              {titleArt ? (
                <ArtTitle name={`art-titlecast-pocket-${kind}` as ArtName} label={help.title} maxHeight={64} maxWidth={2000} as="h2" />
              ) : (
                <h2 className="text-2xl font-black uppercase tracking-wide text-center" style={{ color: 'var(--color-text)' }}>{help.title}</h2>
              )}
            </div>
            <p className="text-[11px] font-black uppercase text-center mt-1.5" style={{ letterSpacing: '0.12em', color: SOFT_INK.label }}>How to play</p>

            <ol className="mt-3 space-y-2">
              {help.steps.map((step, i) => (
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
                    <div className="mt-2 flex items-center gap-1.5 flex-wrap" aria-hidden="true">
                      {step.picture.art.map((a, j) => (
                        <span key={j} className="inline-flex items-center gap-1.5">
                          {j > 0 && step.picture.joiners[j - 1] && (
                            <span className="text-[10px] font-black uppercase" style={{ color: SOFT_INK.label, letterSpacing: 0.6 }}>{step.picture.joiners[j - 1]}</span>
                          )}
                          <span className={still ? undefined : 'art-pop'} style={still ? undefined : { animationDelay: `${i * 160 + j * 90}ms` }}><Piece name={a} /></span>
                        </span>
                      ))}
                    </div>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-3 text-[12.5px] font-extrabold text-center" style={{ color: 'var(--color-text)' }}>{help.win}</p>
            <p className="mt-1 text-[11.5px] font-bold text-center" style={{ color: 'var(--color-text-secondary)' }}>{help.turns}</p>

            <div className="mt-4 flex justify-center">
              <CandyButton size="md" style={candyAccent} icon="check" onClick={onClose}>
                {firstPlay ? TUTORIAL_BUTTON_FIRST : TUTORIAL_BUTTON_AGAIN}
              </CandyButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
