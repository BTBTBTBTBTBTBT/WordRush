'use client';

import { useId } from 'react';
import { heroStats, recordBar, type HeroInput } from '@wordle-duel/core';
import { SoftNum } from '@/components/ui/soft-number';
import { ART_SIZE, artSrc } from '@/lib/art';
import { alphaHex } from '@/lib/soft-surface';

// FRIDAY-QUEUE item 16 (founder 10-07): the Stats game page's four hero stats — Record W–L, Win rate (a ring),
// Streak (best small under it), Fastest — each with a soft 3D stat icon (art-stat-*), no boxes around them. The
// numbers come from core heroStats so iOS and Android say exactly the same thing. The win-rate ring and the
// two-color record bar are drawn in code from the sections/stats specs (a rounded track + a fill arc with a gloss
// stroke), tinted by the game's accent so every game's page reads as its own.

/** A shipped stat icon (art-stat-<name>), decorative. */
export function StatIcon({ name, size = 30 }: { name: 'crown' | 'donut' | 'bolt' | 'stopwatch' | 'star' | 'target'; size?: number }) {
  const art = `art-stat-${name}` as const;
  const dims = (ART_SIZE as Record<string, readonly [number, number]>)[art];
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={artSrc(art)} alt="" aria-hidden="true" draggable={false} decoding="async" width={dims?.[0]} height={dims?.[1]}
    style={{ width: size, height: size, objectFit: 'contain', flexShrink: 0 }} />;
}

/** The win-rate ring (sections/stats win-rate-ring spec): rounded track + fill arc from 12 o'clock + a gloss stroke. */
export function WinRateRing({ pct, size = 52, accent = '#7c3aed', children }: { pct: number; size?: number; accent?: string; children?: React.ReactNode }) {
  const id = useId();
  const stroke = Math.max(6, Math.round(size * 0.17));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(1, pct / 100));
  return (
    <span className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`Win rate ${Math.round(pct)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent} stopOpacity="0.85" />
            <stop offset="1" stopColor={accent} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={alphaHex(accent, 0.16)} strokeWidth={stroke} />
        {frac > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#${id}-g)`} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${c * frac} ${c}`} style={{ transition: 'stroke-dasharray 0.7s ease' }} />
        )}
        {/* the gloss: a pale arc hugging the top-left of the ring */}
        <circle cx={size / 2} cy={size / 2} r={r - stroke * 0.18} fill="none" stroke="#fff" strokeOpacity="0.38" strokeWidth={Math.max(1.5, stroke * 0.16)}
          strokeLinecap="round" strokeDasharray={`${c * 0.16} ${c}`} strokeDashoffset={-c * 0.04} />
      </svg>
      {children && <span className="absolute inset-0 flex items-center justify-center">{children}</span>}
    </span>
  );
}

/** The two-color record bar (sections/stats record-bar spec): wins in the first color, losses in the second, glossy. */
export function RecordBar({ wins, losses, height = 10, from = '#7c3aed', to = '#ec4899', className = '' }: {
  wins: number; losses: number; height?: number; from?: string; to?: string; className?: string;
}) {
  const bar = recordBar(wins, losses);
  return (
    <span className={`relative flex w-full overflow-hidden ${className}`} style={{ height, borderRadius: height, background: alphaHex(from, 0.14) }}
      role="img" aria-label={`${wins} wins, ${losses} losses`}>
      {!bar.empty && (
        <>
          <span style={{ width: `${bar.winFrac * 100}%`, background: from, borderRadius: height }} />
          <span style={{ width: `${bar.lossFrac * 100}%`, background: to, marginLeft: wins > 0 && losses > 0 ? -height / 2 : 0, borderRadius: height }} />
        </>
      )}
      <span aria-hidden="true" className="absolute left-1.5 right-1.5" style={{ top: height * 0.16, height: Math.max(1.5, height * 0.2), borderRadius: height, background: 'rgba(255,255,255,0.4)' }} />
    </span>
  );
}

/**
 * The four hero stats on one row: icon over a soft number over a small label. Soft 3D icons only (no box); the
 * win rate is the ring with its percent inside. `bestSub` is the streak's small "Best N".
 */
export function HeroStatsRow({ input, accent, className = '' }: { input: HeroInput; accent: string; className?: string }) {
  const stats = heroStats(input);
  return (
    <div className={`grid grid-cols-4 gap-2 ${className}`}>
      {stats.map((s) => (
        <div key={s.key} className="flex flex-col items-center text-center min-w-0">
          {s.key === 'winRate' ? (
            <WinRateRing pct={input.wins + input.losses > 0 ? (input.wins / (input.wins + input.losses)) * 100 : 0} size={44} accent={accent} />
          ) : (
            <StatIcon name={s.icon === 'donut' ? 'star' : s.icon} size={44} />
          )}
          <SoftNum size={20} as="div" className="soft-num-auto leading-tight mt-1 max-w-full truncate">{s.value}</SoftNum>
          <div className="text-[9px] font-extrabold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{s.label}</div>
          <div className="text-[9px] font-extrabold h-[11px]" style={{ color: accent }}>{s.sub ?? ''}</div>
        </div>
      ))}
    </div>
  );
}
