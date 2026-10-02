'use client';

import { LetterTile } from '@/components/game/letter-tile';
import { Icon3D } from '@/components/ui/icon3d';
import type { HelpExample as HelpExampleData, HelpRow } from '@/lib/help-steps';
import { darken, softMix } from '@/lib/soft-surface';

// One step's tiny example (docs/FINISH_SPEC.md AF): a row (or two) of the real
// B-kit glossy tiles — colored tiles turn over left → right after `delay` ms,
// like a guess being scored — or a few candy chips (found words, group bars,
// hint names). Decorative: the step's text says it, so the whole example is
// aria-hidden. `still` (Reduce Motion) = no flips, no pops, static tiles.

const CHIP_FILL: Record<'gold' | 'slate' | 'red', { bg: string; ink: string; lip: string }> = {
  gold: { bg: 'linear-gradient(#ffd166, #f5a524 70%, #e8901a)', ink: '#4a2a00', lip: '#b0650b' },
  slate: { bg: 'linear-gradient(#8d99b0, #6b7891 70%, #5d6981)', ink: '#ffffff', lip: '#3f4a5e' },
  red: { bg: 'linear-gradient(#ff8a9b, #f0435f 70%, #d9324e)', ink: '#ffffff', lip: '#b4233c' },
};

/** Tile size (CSS px) for a row of `n` tiles, so 9 still fit a phone card. */
function tileSize(n: number): number {
  if (n <= 5) return 28;
  if (n <= 7) return 25;
  return 22;
}

function Row({ row, size, delay, still }: { row: HelpRow; size: number; delay: number; still: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex" style={{ gap: Math.max(2, Math.round(size / 9)), ['--gt-font' as string]: `${Math.round(size * 0.56)}px` } as React.CSSProperties}>
        {row.tiles.map((t, i) => {
          const flip = !still && t.flip;
          return (
            <LetterTile
              key={i}
              letter={t.ch}
              look={t.look}
              flipIndex={flip ? 0 : undefined}
              flipSound={false}
              pop={!still && t.look === 'typed'}
              style={{ width: size, height: size, ...(flip ? { ['--gt-d' as string]: `${delay + i * 120}ms` } : null) } as React.CSSProperties}
            />
          );
        })}
      </div>
      {row.check && <Icon3D name="badge-check" size={Math.round(size * 0.7)} />}
      {row.tag && (
        <span className="text-[10px] font-black uppercase whitespace-nowrap" style={{ letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>
          {row.tag}
        </span>
      )}
    </div>
  );
}

export function HelpExample({ example, accent, delay, still }: { example: HelpExampleData; accent: string; delay: number; still: boolean }) {
  if (example.kind === 'chips') {
    return (
      <div className="flex flex-wrap gap-1.5" aria-hidden="true">
        {example.chips.map((c, i) => {
          const fill = c.tone === 'accent'
            ? { bg: `linear-gradient(${softMix(accent, 0.7)}, ${accent})`, ink: '#ffffff', lip: darken(accent, 0.3) }
            : CHIP_FILL[c.tone];
          return (
            <span
              key={i}
              className={`inline-flex items-center rounded-full px-2.5 text-[11px] font-black uppercase ${still ? '' : 'rp-pop'}`}
              style={{
                height: 24,
                letterSpacing: '0.05em',
                background: fill.bg,
                color: fill.ink,
                boxShadow: `inset 0 -2.5px 0 ${fill.lip}, inset 0 1.5px 0 rgba(255, 255, 255, 0.45)`,
                textShadow: fill.ink === '#ffffff' ? '0 1px 1px rgba(0, 0, 0, 0.25)' : undefined,
                animationDelay: still ? undefined : `${delay + i * 90}ms`,
              }}
            >
              {c.label}
            </span>
          );
        })}
      </div>
    );
  }
  const size = tileSize(Math.max(...example.rows.map((r) => r.tiles.length)));
  return (
    <div className="flex flex-col items-start gap-1" aria-hidden="true">
      {example.rows.map((row, ri) => (
        <div key={ri} className="flex flex-col items-start gap-1">
          {ri > 0 && example.arrow && (
            <svg width={14} height={12} viewBox="0 0 14 12" style={{ marginLeft: Math.round(size / 2) }}>
              <path d="M7 11L1.5 4.5h3.5V1h4v3.5h3.5z" fill="var(--color-text-muted)" opacity={0.7} />
            </svg>
          )}
          <Row row={row} size={size} delay={delay + ri * 500} still={still} />
        </div>
      ))}
    </div>
  );
}
