import Link from 'next/link';
import { Mascot } from '@/components/ui/mascot';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { CastButton } from '@/components/ui/cast-button';
import type { MascotId } from '@/lib/mascots';
import { PodiumPedestal } from '@/components/leaderboard/podium';

// FINISH_SPEC BI23 (founder, 2026-10-03: "get rid of the sign in to track your stats
// gray circle image and make that screen look nicer"): the signed-out Stats / Friends
// body under the pinned AppHeader (iOS + Android `GuestPitch`). The page host (or a cast
// duo) pops in once, a gradient caps headline, one line, a dimmed decorative preview
// (sample chips or a mini podium: soft glossy tiles, no border), the SIGN IN candy
// button and a quiet "Play without an account" link. It grows to fill the space below
// the header and centers in it, so the header never moves between tabs.

export interface GuestChip { icon: Icon3DName; value: string; label: string; accent: string }
export type GuestPreview = { kind: 'chips'; chips: GuestChip[] } | { kind: 'podium' } | { kind: 'none' };

export const GUEST_STATS_CHIPS: GuestChip[] = [
  { icon: 'flame', value: '12', label: 'STREAK', accent: '#f97316' },
  { icon: 'trophy', value: '48', label: 'WINS', accent: '#f59e0b' },
  { icon: 'crown', value: '1:42', label: 'BEST TIME', accent: '#7c3aed' },
];
export const GUEST_GRADIENTS = {
  stats: 'linear-gradient(90deg, #2563eb, #8b5cf6)',
  leaderboard: 'linear-gradient(90deg, #f59e0b, #ea580c)',
  friends: 'linear-gradient(90deg, #db2777, #f97316)',
} as const;

/** The soft glossy face (game kit: a darker lip, a gradient face, a top gloss), no border. */
function glossStyle(accent: string, radius: number): React.CSSProperties {
  return {
    borderRadius: radius,
    background: `linear-gradient(180deg, rgba(255,255,255,0.38) 0, rgba(255,255,255,0) 32px), linear-gradient(180deg, ${accent}9e, ${accent}e0)`,
    boxShadow: `0 3px 0 ${accent}f2, 0 8px 16px ${accent}38`,
  };
}

function Chip({ c }: { c: GuestChip }) {
  return (
    <div className="flex flex-col items-center justify-center gap-0.5" style={{ width: 92, height: 88, ...glossStyle(c.accent, 16) }}>
      <Icon3D name={c.icon} size={24} />
      <span className="text-xl font-black text-white leading-none" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.18)' }}>{c.value}</span>
      <span className="font-extrabold text-white/90 whitespace-nowrap" style={{ fontSize: 9, letterSpacing: 0.4 }}>{c.label}</span>
    </div>
  );
}

function Podium() {
  const steps = [
    { rank: 2, h: 56 },
    { rank: 1, h: 78 },
    { rank: 3, h: 42 },
  ];
  return (
    <div className="flex items-end gap-2">
      {steps.map((s) => (
        <div key={s.rank} className="flex flex-col items-center gap-1" style={{ width: 78 }}>
          {s.rank === 1 && <Icon3D name="crown" size={28} />}
          <PodiumPedestal place={s.rank} height={s.h} />
        </div>
      ))}
    </div>
  );
}

export function GuestPitch({ hosts, title, subtitle, gradient, preview, onSignIn, subColor = 'var(--color-text-secondary)', className = '' }: {
  hosts: MascotId[];
  title: string;
  subtitle: string;
  gradient: string;
  preview: GuestPreview;
  onSignIn: () => void;
  subColor?: string;
  className?: string;
}) {
  const duo = hosts.length > 1;
  return (
    <section className={`flex flex-1 flex-col items-center justify-center text-center px-5 py-6 ${className}`}>
      <div className="flex justify-center" style={{ gap: 0 }}>
        {hosts.map((h, i) => (
          <Mascot key={h} id={h} size={duo ? 104 : 120} motion="pop" priority style={i > 0 ? { marginLeft: -18 } : undefined} />
        ))}
      </div>
      <h1
        className="mt-2.5 font-black uppercase leading-tight text-transparent bg-clip-text"
        style={{ fontSize: 28, letterSpacing: 0.4, backgroundImage: gradient }}
      >
        {title}
      </h1>
      <p className="mt-1.5 text-[15px] font-semibold max-w-xs" style={{ color: subColor }}>{subtitle}</p>
      {preview.kind !== 'none' && (
        <div className="mt-5 opacity-[0.72]" aria-hidden="true">
          {preview.kind === 'chips' ? (
            <div className="flex gap-2.5">{preview.chips.map((c) => <Chip key={c.label} c={c} />)}</div>
          ) : (
            <Podium />
          )}
        </div>
      )}
      <CastButton onClick={onSignIn} color="purple" size="lg" className="mt-6">Sign In</CastButton>
      <Link href="/" className="mt-1.5 inline-flex min-h-[44px] items-center px-2 text-sm font-bold underline" style={{ color: subColor }}>
        Play without an account
      </Link>
    </section>
  );
}
