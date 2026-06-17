'use client';

import { useEffect, useMemo, useState } from 'react';
import { Trophy, Sparkles, Share2, X as XIcon } from 'lucide-react';
import { haptic } from '@/lib/haptics';
import { playSuccess } from '@/lib/sounds';
import type { DailyCompletion } from '@/lib/daily-service';
import { computeDailyTotals } from '@/lib/daily-service';
import { shareDailySweep } from '@/lib/daily-share';
import type { ShareMode } from '@/lib/share-image';
import { MODE_SHARE_GLYPH } from '@/lib/share-image';

// One-time full-screen celebration shown when the player completes all 9 daily
// puzzles. Two distinct treatments (NOT the per-game victory confetti, which
// would look redundant when the final daily was itself a win):
//   • Daily Sweep      → violet/pink sparkle burst.
//   • Flawless Victory → gold fireworks + foil shimmer.

interface ModeMeta { dbKey: string; mode: ShareMode; label: string; accent: string }
const MODES: ModeMeta[] = [
  { dbKey: 'DUEL', mode: 'Classic', label: 'Classic', accent: '#7c3aed' },
  { dbKey: 'QUORDLE', mode: 'QuadWord', label: 'QuadWord', accent: '#ec4899' },
  { dbKey: 'OCTORDLE', mode: 'OctoWord', label: 'OctoWord', accent: '#7e22ce' },
  { dbKey: 'SEQUENCE', mode: 'Succession', label: 'Succession', accent: '#2563eb' },
  { dbKey: 'RESCUE', mode: 'Deliverance', label: 'Deliverance', accent: '#059669' },
  { dbKey: 'DUEL_6', mode: 'Six', label: 'Six', accent: '#06b6d4' },
  { dbKey: 'DUEL_7', mode: 'Seven', label: 'Seven', accent: '#84cc16' },
  { dbKey: 'GAUNTLET', mode: 'Gauntlet', label: 'Gauntlet', accent: '#d97706' },
  { dbKey: 'PROPERNOUNDLE', mode: 'ProperNoundle', label: 'Proper', accent: '#dc2626' },
];

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

interface Props {
  completions: Map<string, DailyCompletion>;
  onClose: () => void;
}

export function SweepCelebration({ completions, onClose }: Props) {
  const totals = useMemo(() => computeDailyTotals(completions), [completions]);
  const flawless = totals.flawless;
  const [sharing, setSharing] = useState(false);

  useEffect(() => { haptic('heavy'); playSuccess(); }, []);

  // Pre-compute particle vectors (radial). Flawless gets more, larger sparks.
  const particles = useMemo(() => {
    const count = flawless ? 28 : 20;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + (i % 2) * 0.4;
      const dist = (flawless ? 170 : 130) + (i % 5) * 22;
      return {
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist,
        delay: (i % 7) * 0.12,
        size: flawless ? 10 + (i % 4) * 4 : 8 + (i % 3) * 3,
      };
    });
  }, [flawless]);

  const titleGradient = flawless
    ? 'linear-gradient(135deg, #fbbf24, #d97706, #b45309)'
    : 'linear-gradient(135deg, #a78bfa, #ec4899)';

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try { await shareDailySweep(completions); } finally { setSharing(false); }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-5 animate-fade-in"
      style={{ backgroundColor: 'rgba(24, 24, 46, 0.7)' }}
      onClick={onClose}
    >
      {/* Radial particle burst centered behind the card. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative" style={{ width: 0, height: 0 }}>
          {particles.map((p, i) => (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: 0, top: -120,
                width: p.size, height: p.size,
                ['--dx' as string]: `${p.dx}px`,
                ['--dy' as string]: `${p.dy}px`,
                borderRadius: flawless ? '50%' : '2px',
                background: flawless
                  ? 'radial-gradient(circle, #fde68a, #f59e0b)'
                  : (i % 2 ? '#c4b5fd' : '#f9a8d4'),
                boxShadow: flawless ? '0 0 8px rgba(245,158,11,0.8)' : '0 0 6px rgba(167,139,250,0.7)',
                animation: `${flawless ? 'firework-spark' : 'sweep-spark'} ${flawless ? 1.6 : 1.9}s ease-out ${p.delay}s infinite`,
              }}
            />
          ))}
        </div>
      </div>

      <div
        className="relative max-w-sm w-full animate-fade-in-scale"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative overflow-hidden text-center"
          style={{
            background: flawless
              ? 'linear-gradient(160deg, #fffbeb, #fef3c7)'
              : 'linear-gradient(160deg, #faf5ff, #fce7f3)',
            border: flawless ? '1.5px solid #f59e0b' : '1.5px solid #c4b5fd',
            borderRadius: '18px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          }}
        >
          {/* Foil shimmer sweep (stronger for Flawless). */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div
              className="animate-foil-sweep absolute top-0 h-full"
              style={{
                width: '40%',
                background: flawless
                  ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.7), transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              }}
            />
          </div>

          {/* Top accent bar */}
          <div
            className="h-1.5"
            style={{ background: flawless
              ? 'linear-gradient(90deg, #fbbf24, #d97706, #fbbf24)'
              : 'linear-gradient(90deg, #a78bfa, #ec4899, #a78bfa)' }}
          />

          <div className="relative px-5 pt-5 pb-5">
            <div className="flex items-center justify-center gap-2">
              {flawless
                ? <Trophy className="w-7 h-7" style={{ color: '#d97706' }} fill="currentColor" />
                : <Sparkles className="w-6 h-6" style={{ color: '#7c3aed' }} />}
              <h2
                className="text-3xl font-black text-transparent bg-clip-text"
                style={{ backgroundImage: titleGradient }}
              >
                {flawless ? 'FLAWLESS VICTORY!' : 'DAILY SWEEP!'}
              </h2>
              {flawless
                ? <Trophy className="w-7 h-7" style={{ color: '#d97706' }} fill="currentColor" />
                : <Sparkles className="w-6 h-6" style={{ color: '#ec4899' }} />}
            </div>

            <p className="text-xs font-extrabold mt-1" style={{ color: flawless ? '#b45309' : '#6d28d9' }}>
              {flawless
                ? `All ${totals.total} daily puzzles won today`
                : `All ${totals.total} daily puzzles completed today`}
            </p>

            {/* Summary totals */}
            <div className="flex justify-center gap-6 mt-4">
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{totals.won}/{totals.total}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Won</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{fmtTime(totals.totalTimeSeconds)}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Time</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: 'var(--color-text)' }}>{totals.totalScore.toLocaleString()}</div>
                <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total Pts</div>
              </div>
            </div>

            {/* Per-game list */}
            <div
              className="mt-4 px-3 py-2 grid grid-cols-3 gap-1.5"
              style={{ background: 'rgba(255,255,255,0.55)', borderRadius: '12px' }}
            >
              {MODES.map((m) => {
                const c = completions.get(m.dbKey);
                if (!c) return null;
                return (
                  <div key={m.dbKey} className="flex items-center gap-1.5 px-1 py-0.5">
                    <span
                      className="flex items-center justify-center font-black text-white shrink-0"
                      style={{ width: 22, height: 22, borderRadius: 7, background: m.accent, fontSize: MODE_SHARE_GLYPH[m.mode].length >= 3 ? 9 : 12 }}
                    >
                      {MODE_SHARE_GLYPH[m.mode]}
                    </span>
                    <span className="text-[11px] font-bold truncate" style={{ color: 'var(--color-text)' }}>{m.label}</span>
                    <span className="text-[11px] font-black ml-auto" style={{ color: c.won ? '#16a34a' : '#dc2626' }}>
                      {c.won ? '✓' : '✗'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleShare}
                disabled={sharing}
                className="btn-3d flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-white font-black"
                style={{ background: flawless ? 'linear-gradient(135deg, #d97706, #b45309)' : 'linear-gradient(135deg, #7c3aed, #ec4899)' }}
              >
                <Share2 className="w-4 h-4" />
                {sharing ? 'Sharing…' : 'Share'}
              </button>
              <button
                onClick={onClose}
                className="btn-3d flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-black"
                style={{ background: 'rgba(255,255,255,0.7)', border: '1.5px solid var(--color-border)', color: flawless ? '#b45309' : '#7c3aed' }}
              >
                <XIcon className="w-4 h-4" />
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
