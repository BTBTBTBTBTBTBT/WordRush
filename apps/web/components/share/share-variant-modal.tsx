'use client';

import { useEffect, useState } from 'react';

import { X, EyeOff, Eye } from 'lucide-react';

export type ShareVariant = 'clean' | 'full';

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
        className="relative w-full max-w-sm p-5 animate-modal-content"
        style={{
          background: 'var(--color-surface)',
          borderRadius: '24px',
          boxShadow: '0 30px 80px rgba(0,0,0,0.2)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Share options"
      >
        <button
          onClick={() => settle(null)}
          aria-label="Close"
          className="absolute top-3 right-3 p-1.5 rounded-full transition-colors hover:bg-gray-100"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-lg font-black text-center mb-3" style={{ color: 'var(--color-text)' }}>
          Share your result
        </h3>

        <div className="space-y-2">
          <button
            onClick={() => settle('clean')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm text-white btn-3d"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 0 #4c1d95',
            }}
          >
            <EyeOff className="w-4 h-4" />
            <span>
              No spoilers
              <span className="block text-[11px] font-bold opacity-80">Colors only</span>
            </span>
          </button>

          <button
            onClick={() => settle('full')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-extrabold text-sm transition-colors"
            style={{
              background: 'var(--color-bg)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text)',
            }}
          >
            <Eye className="w-4 h-4" />
            <span>
              Full results
              <span className="block text-[11px] font-bold" style={{ color: 'var(--color-text-muted)' }}>Letters revealed</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
