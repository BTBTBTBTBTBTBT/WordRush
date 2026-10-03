'use client';

import { candyClass, type CandyColor } from '@/components/ui/candy-button';
import { artSrc, type PoseArtName } from '@/lib/art';
import { darken } from '@/lib/soft-surface';
import { VS } from '@/lib/vs-lobby';
import { CardBar, vsCard } from './vs-ui';

// A VS in-app notice (docs/FINISH_SPEC.md K1): a tinted card (A1) in the
// event's color with its top bar, the sender's avatar (their letter tile,
// §20), a small cast pose that fits the event (vs-notice-art.ts, A7), the
// headline in Nunito Black, a detail line with soft numbers for the scores,
// and a candy action face. The whole card is the tap target (it squishes,
// A9); it slides in with a spring — instant with Reduce Motion (the global
// reduced-motion rules in globals.css zero every animation).

export function VsNotice({ accent, avatar, pose, headline, detail, action, actionColor = 'teal', onClick, index = 0, label }: {
  accent: string;
  /** The sender's avatar (InitialAvatar / letter tile). */
  avatar?: React.ReactNode;
  pose: PoseArtName;
  headline: React.ReactNode;
  detail?: React.ReactNode;
  /** The candy action's label (Race / View / Rematch). */
  action: string;
  actionColor?: CandyColor;
  onClick: () => void;
  /** Stagger for a list (0, 1, 2…). */
  index?: number;
  /** Accessible name for the whole card. */
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="vs-notice relative w-full flex flex-col text-left overflow-hidden"
      style={{ ...vsCard(accent, { radius: 16 }), animationDelay: `${index * 70}ms` }}
    >
      <style>{`
        @keyframes vs-notice-in {
          0% { transform: translateY(-14px) scale(0.96); opacity: 0; }
          60% { transform: translateY(3px) scale(1.01); opacity: 1; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        .vs-notice { animation: vs-notice-in 520ms cubic-bezier(0.3, 1.4, 0.45, 1) backwards; }
        @media (prefers-reduced-motion: reduce) { .vs-notice { animation: none; } }
      `}</style>
      <CardBar accent={accent} />
      {/* BJ7: one top line — avatar, headline, pose and action top-aligned; detail 4 under. */}
      <span className="w-full flex items-start gap-2.5 py-2 pl-3 pr-2.5">
        {avatar}
        <span className="flex-1 min-w-0">
          <span className="block text-[12.5px] font-black uppercase truncate" style={{ color: darken(accent, 0.4), letterSpacing: 0.4 }}>{headline}</span>
          {detail && <span className="flex flex-wrap items-baseline gap-x-1 text-[11.5px] font-bold mt-1" style={{ color: '#4b5563' }}>{detail}</span>}
        </span>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(pose)} alt="" aria-hidden="true" width={40} height={40} draggable={false} className="shrink-0" style={{ width: 40, height: 40, objectFit: 'contain', marginTop: -4, marginBottom: -4 }} />
        {/* The card is the button; this is its candy face (A8). */}
        <span className={candyClass({ color: actionColor, size: 'sm', extra: 'shrink-0' })} aria-hidden="true">
          <span className="candy-label">{action}</span>
        </span>
      </span>
    </button>
  );
}

/** A dot separator for notice detail lines. */
export function NoticeDot() {
  return <span aria-hidden="true" style={{ color: VS.label }}>·</span>;
}
