'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';

// Branded replacement for window.confirm — the native dialog can't be styled,
// so anywhere a destructive action needs a "you sure?" gets this card instead.
// Promise-based module-listener pattern mirrors ShareVariantHost so call sites
// stay one-liners: `if (!(await confirmDialog({...}))) return;`

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface ConfirmState {
  open: boolean;
  options: ConfirmOptions | null;
  resolve: ((ok: boolean) => void) | null;
}

let listener: ((state: ConfirmState) => void) | null = null;
let currentState: ConfirmState = { open: false, options: null, resolve: null };

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  currentState.resolve?.(false); // a second request replaces the first
  return new Promise((resolve) => {
    currentState = { open: true, options, resolve };
    listener?.(currentState);
  });
}

function settle(ok: boolean): void {
  currentState.resolve?.(ok);
  currentState = { open: false, options: null, resolve: null };
  listener?.(currentState);
}

/** Mount-once host — rendered in the root layout beside ShareVariantHost. */
export function ConfirmDialogHost() {
  const [state, setState] = useState<ConfirmState>(currentState);

  useEffect(() => {
    listener = setState;
    return () => { listener = null; };
  }, []);

  useEffect(() => {
    if (!state.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') settle(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.open]);

  if (!state.open || !state.options) return null;
  const { title, message, confirmText = 'Confirm', cancelText = 'Keep it' } = state.options;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-6"
      style={{ background: 'rgba(17, 12, 34, 0.45)' }}
      onClick={() => settle(false)}
    >
      <div
        className="w-full max-w-sm p-6 text-center"
        style={{
          background: 'var(--color-surface)',
          border: '1.5px solid #c4b5fd',
          borderRadius: '20px',
          boxShadow: '0 8px 32px rgba(124, 58, 237, 0.18)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <AlertTriangle className="w-8 h-8 mx-auto mb-2" style={{ color: '#d97706' }} />
        <h2 className="text-base font-black mb-1" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <p className="text-xs font-bold mb-4" style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        <div className="flex gap-2">
          <button
            onClick={() => settle(false)}
            className="flex-1 py-2.5 rounded-xl text-sm font-black"
            style={{ background: 'var(--color-bg)', border: '1.5px solid var(--color-border)', color: 'var(--color-text)' }}
          >
            {cancelText}
          </button>
          <button
            onClick={() => settle(true)}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white btn-3d"
            style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', boxShadow: '0 4px 0 #7f1d1d' }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
