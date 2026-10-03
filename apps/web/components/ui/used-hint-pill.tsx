// FINISH_SPEC BI25: a used in-game hint ("Vowel: A", "No vowels left") is information,
// not a button — a soft filled pill with no outline (the founder's no-outlines rule
// overrides A8), on the small candy's footprint (32px + its 3px lip) so nothing moves.
// Parity: iOS UsedHintPill (G5Kit.swift), Android HintCandy's used state.

import { softBackground } from '@/lib/soft-surface';

export function UsedHintPill({ children, accent = '#0d9488' }: { children: React.ReactNode; accent?: string }) {
  return (
    <span
      role="status"
      className="flex w-full items-center justify-center font-black truncate"
      style={{
        height: 32, marginBottom: 3, borderRadius: 999, padding: '0 8px', fontSize: 12,
        background: softBackground(accent, 0.2), color: 'var(--color-text)',
      }}
    >
      {children}
    </span>
  );
}
