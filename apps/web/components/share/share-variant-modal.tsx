'use client';

import { useEffect, useState } from 'react';

import { X, EyeOff, Eye, ChevronRight } from 'lucide-react';

export type ShareVariant = 'clean' | 'full';

// Same shape as the menu-modal rows (and the native ShareVariantSheet /
// InfoMenuSheet): accent-tinted icon tile, uppercase title, muted subtitle.
const VARIANTS: {
  variant: ShareVariant;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
}[] = [
  { variant: 'clean', title: 'No spoilers', subtitle: 'Colors only', icon: EyeOff, accent: '#7C3AED' },
  { variant: 'full', title: 'Full results', subtitle: 'Letters revealed', icon: Eye, accent: '#EC4899' },
];

interface VariantModalState {
  open: boolean;
  resolve: ((variant: ShareVariant | null) => void) | null;
}

let listener: ((state: VariantModalState) => void) | null = null;
let currentState: VariantModalState = { open: false, resolve: null };

/**
 * Ask the player which share style they want. Resolves 'clean' (color-only,
 * spoiler-free — today's card), 'full' (letters revealed), or null when
 * dismissed. Module-listener pattern mirrors SharePreviewHost so the six
 * game components' share handlers don't each need chooser state.
 */
export function chooseShareVariant(): Promise<ShareVariant | null> {
  // A second Share tap while the chooser is up replaces the first request.
  currentState.resolve?.(null);
  return new Promise((resolve) => {
    currentState = { open: true, resolve };
    listener?.(currentState);
  });
}

function settle(variant: ShareVariant | null): void {
  currentState.resolve?.(variant);
  currentState = { open: false, resolve: null };
  listener?.(currentState);
}

/** Mount-once host — rendered in the root layout beside SharePreviewHost. */
export function ShareVariantHost() {
  const [state, setState] = useState<VariantModalState>(currentState);

  useEffect(() => {
    listener = setState;
    return () => {
      listener = null;
    };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(null); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.open]);

  if (!state.open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-modal-overlay"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={() => settle(null)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm animate-modal-content"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid var(--color-border)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Share options"
      >
        {/* Top accent bar */}
        <div
          className="h-1.5 flex-shrink-0"
          style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }}
        />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3">
          <h2
            className="text-xl font-black uppercase text-transparent bg-clip-text"
            style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
          >
            Share
          </h2>
          <button
            onClick={() => settle(null)}
            className="flex items-center justify-center w-[30px] h-[30px] rounded-full transition-opacity hover:opacity-80"
            style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Variant rows */}
        <div className="px-4 pb-5 space-y-2">
          {VARIANTS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.variant}
                onClick={() => settle(v.variant)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl transition-transform active:scale-[0.98]"
                style={{ background: 'var(--color-surface)', border: '1.5px solid var(--color-border)' }}
              >
                <span
                  className="flex-shrink-0 w-10 h-10 rounded-[11px] flex items-center justify-center"
                  style={{ background: `${v.accent}24` }}
                >
                  <Icon className="w-4 h-4" style={{ color: v.accent }} />
                </span>
                <span className="min-w-0 flex flex-col items-start">
                  <span className="text-[15px] font-black uppercase leading-tight" style={{ color: 'var(--color-text)' }}>
                    {v.title}
                  </span>
                  <span className="text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>
                    {v.subtitle}
                  </span>
                </span>
                <ChevronRight className="w-[13px] h-[13px] ml-auto flex-shrink-0" style={{ color: 'var(--color-text-muted)' }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
