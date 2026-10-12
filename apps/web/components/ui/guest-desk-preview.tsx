import type { CSSProperties, ReactNode } from 'react';
import { Mascot } from '@/components/ui/mascot';
import { GuestChip, GUEST_STATS_CHIPS, GuestChipTile } from '@/components/ui/guest-pitch';
import { BRAND_ACCENT, alphaHex, cardBarStyle, softCard } from '@/lib/soft-surface';
import type { MascotId } from '@/lib/mascots';

// Desktop website (founder 10-12): the signed-out Stats / Friends gates beside their pitch show a softly
// faded PREVIEW of the panels behind the sign-in. Decorative and static (aria-hidden): generic sample
// numbers under an explicit "Preview" label, never anything that could pass for a real player's data.
// Phones never render it (GuestPitch's `deskPreview` slot is hidden below 1024 px).

const FADE: CSSProperties = {
  opacity: 0.88,
  WebkitMaskImage: 'linear-gradient(#000 62%, transparent 100%)',
  maskImage: 'linear-gradient(#000 62%, transparent 100%)',
};

function PreviewLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 px-1 text-[11px] font-black uppercase" style={{ letterSpacing: 1.2, color: 'var(--color-text-muted)' }}>
      {children}
    </div>
  );
}

const STAT_ROWS: { name: string; pct: number; accent: string }[] = [
  { name: 'Classic', pct: 86, accent: '#7c3aed' },
  { name: 'QuadWord', pct: 72, accent: '#ec4899' },
  { name: 'Six', pct: 64, accent: '#06b6d4' },
  { name: 'OctoWord', pct: 51, accent: '#7e22ce' },
];

/** Stats: the player card's chips and a win-rate-by-mode list. */
export function StatsDeskPreview() {
  const chips: GuestChip[] = GUEST_STATS_CHIPS;
  return (
    <div className="w-full mx-auto text-left" style={{ maxWidth: 500, ...FADE }} aria-hidden="true">
      <PreviewLabel>Preview · sample numbers</PreviewLabel>
      <div className="overflow-hidden" style={softCard(BRAND_ACCENT, { radius: 20 })}>
        <div style={{ height: 10, background: 'linear-gradient(90deg, #7c3aed, #ec4899)' }} />
        <div className="p-4">
          <div className="flex items-center gap-3">
            <Mascot id="d" size={56} />
            <div>
              <div className="text-base font-black" style={{ color: 'var(--color-text)' }}>Your name here</div>
              <div className="text-xs font-extrabold" style={{ color: 'var(--color-text-secondary)' }}>Level 7 · 4,200 XP</div>
            </div>
          </div>
          <div className="mt-3.5 flex justify-center gap-2.5">
            {chips.map((c) => <GuestChipTile key={c.label} c={c} />)}
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {STAT_ROWS.map((r) => (
              <div key={r.name} className="flex items-center gap-3">
                <span className="w-[74px] shrink-0 text-xs font-black" style={{ color: 'var(--color-text)' }}>{r.name}</span>
                <span className="h-3 flex-1 rounded-full overflow-hidden" style={{ background: alphaHex(r.accent, 0.16) }}>
                  <span className="block h-full rounded-full" style={{ width: `${r.pct}%`, background: `linear-gradient(90deg, ${alphaHex(r.accent, 0.8)}, ${r.accent})` }} />
                </span>
                <span className="w-10 shrink-0 text-right text-xs font-black" style={{ color: 'var(--color-text-secondary)' }}>{r.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const FRIEND_ROWS: { host: MascotId; line: string; tag: string; accent: string }[] = [
  { host: 'o1', line: 'Solved today’s Classic in 4', tag: '1st', accent: '#ec4899' },
  { host: 'c', line: 'On a 9-day streak', tag: '9', accent: '#f97316' },
  { host: 'i', line: 'Challenged you to a VS Battle', tag: 'VS', accent: '#0d9488' },
  { host: 'u', line: 'Finished the Daily Sweep', tag: '★', accent: '#7c3aed' },
];

/** Friends: a friends list with what they have been up to. */
export function FriendsDeskPreview() {
  return (
    <div className="w-full mx-auto text-left" style={{ maxWidth: 500, ...FADE }} aria-hidden="true">
      <PreviewLabel>Preview · sample friends</PreviewLabel>
      <div className="overflow-hidden" style={softCard('#ec4899', { radius: 20 })}>
        <div style={cardBarStyle('#ec4899', 10)} />
        <div className="p-3 flex flex-col gap-2">
          {FRIEND_ROWS.map((r) => (
            <div key={r.line} className="flex items-center gap-3 px-3 py-2" style={{ background: alphaHex(r.accent, 0.1), borderRadius: 16 }}>
              <Mascot id={r.host} size={44} />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-black" style={{ color: 'var(--color-text)' }}>A friend</div>
                <div className="text-xs font-bold truncate" style={{ color: 'var(--color-text-secondary)' }}>{r.line}</div>
              </div>
              <span
                className="shrink-0 grid place-items-center text-[11px] font-black text-white"
                style={{ minWidth: 34, height: 26, padding: '0 8px', borderRadius: 999, background: `linear-gradient(${alphaHex(r.accent, 0.8)}, ${r.accent})`, boxShadow: `0 2px 0 ${alphaHex(r.accent, 0.5)}` }}
              >
                {r.tag}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
