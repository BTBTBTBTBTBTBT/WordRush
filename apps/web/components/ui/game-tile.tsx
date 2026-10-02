import type { ButtonHTMLAttributes, ComponentType, CSSProperties, ReactNode } from 'react';

// One game-tile style everywhere (founder, 2026-10-01; docs/GAME_TILE_STYLE.md).
// The reference is the home mode card in its completed state
// (components/home/mode-card.tsx): the game's accent at ~6% over the surface,
// a 1.5 px border at 40%, a 4 px gradient bar across the top, a 32 × 32 soft
// icon chip. `GameTile` is that card; `GameSquare` is the 1 : 1 selector
// version (icon chip + a short label of up to two centered lines) with a selected state of a 2 px
// full-accent border, a soft glow, the label in the accent and a ~12% tint.
// No 'use client': no hooks here, so server pages (the guides index) can use
// the surface helper and bar too.

export const GAME_TILE_RADIUS = 14;

/**
 * 'theme' follows the app's light/dark tokens; 'light' is for the pages that
 * are always light (Friends, VS), where the tile sits over white.
 */
export type GameTileTone = 'theme' | 'light';

const TONE = {
  theme: { surface: 'var(--color-surface)', text: 'var(--color-text)', muted: 'var(--color-text-muted)' },
  light: { surface: '#ffffff', text: '#1a1a2e', muted: '#9ca3af' },
} as const;

/** Background, border, radius and (when selected) glow of a game tile. */
export function gameTileSurface(
  accent: string,
  { selected = false, tone = 'theme', radius = GAME_TILE_RADIUS }: { selected?: boolean; tone?: GameTileTone; radius?: number } = {},
): CSSProperties {
  const tint = selected ? `${accent}1f` : `${accent}0f`;
  return {
    background: `linear-gradient(${tint}, ${tint}), ${TONE[tone].surface}`,
    border: selected ? `2px solid ${accent}` : `1.5px solid ${accent}66`,
    borderRadius: radius,
    boxShadow: selected ? `0 0 10px ${accent}66` : undefined,
  };
}

/** The 4 px accent bar across the top (the parent must be `relative overflow-hidden`). */
export function GameTileBar({ accent, radius = GAME_TILE_RADIUS }: { accent: string; radius?: number }) {
  return (
    <div
      aria-hidden="true"
      className="absolute top-0 left-0 right-0 h-1 pointer-events-none"
      style={{ background: `linear-gradient(90deg, ${accent}, ${accent}88)`, borderRadius: `${radius}px ${radius}px 0 0` }}
    />
  );
}

/** What goes in the chip: a roman numeral, a lucide-style icon, or any node. */
export function GameTileGlyph({ accent, icon: Icon, romanNumeral, size = 16 }: {
  accent: string; icon?: ComponentType<any> | null; romanNumeral?: string | null; size?: number;
}) {
  if (romanNumeral) {
    return <span className="font-black leading-none" style={{ color: accent, fontSize: Math.round(size * 0.69) }}>{romanNumeral}</span>;
  }
  if (Icon) return <Icon style={{ width: size, height: size, color: accent }} />;
  return null;
}

/** The soft 32 × 32 icon chip (accent at ~8%, radius 8). `width` may shrink it in tight squares. */
export function GameTileChip({ accent, children, width = 32 }: { accent: string; children: ReactNode; width?: number | string }) {
  return (
    <span
      className="flex items-center justify-center shrink-0"
      style={{ width, aspectRatio: '1 / 1', borderRadius: 8, background: `${accent}15` }}
    >
      {children}
    </span>
  );
}

type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'title' | 'style'>;

/** The card variant: chip, title (13 / 900) and a two-line sub (10 / 700, muted). */
export function GameTile({ accent, glyph, title, sub, tone = 'theme', className = '', style, children, ...rest }: ButtonProps & {
  accent: string;
  /** Chip contents (usually <GameTileGlyph/>), drawn in the accent. */
  glyph: ReactNode;
  title: ReactNode;
  sub?: ReactNode;
  tone?: GameTileTone;
  style?: CSSProperties;
  /** Overlays (badges, locks) positioned inside the tile. */
  children?: ReactNode;
}) {
  const t = TONE[tone];
  return (
    <button
      type="button"
      {...rest}
      className={`relative flex flex-col items-start px-3 py-3 text-left overflow-hidden transition-transform active:scale-[0.96] ${className}`}
      style={{ ...gameTileSurface(accent, { tone }), ...style }}
    >
      <GameTileBar accent={accent} />
      {children}
      <span className="mb-1.5"><GameTileChip accent={accent}>{glyph}</GameTileChip></span>
      <span className="text-[13px] font-black leading-tight" style={{ color: t.text }}>{title}</span>
      {sub != null && (
        <span
          className="text-[10px] font-bold mt-0.5"
          style={{ color: t.muted, height: 28, lineHeight: '14px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
        >
          {sub}
        </span>
      )}
    </button>
  );
}

/**
 * The square selector variant. `size` fixes the side in px; without it the
 * square fills its grid cell (w-full, 1 : 1, stretched to the row's height). Below 48 px the square is
 * compact: no chip and no label, just the glyph on the tinted tile (the VS
 * mode strip, the favorite-mode chooser); pass `aria-label` there.
 */
export function GameSquare({ accent, glyph, label, selected = false, size, tone = 'theme', className = '', style, children, ...rest }: ButtonProps & {
  accent: string;
  glyph: ReactNode;
  label?: ReactNode;
  selected?: boolean;
  size?: number;
  tone?: GameTileTone;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  const t = TONE[tone];
  const compact = size != null && size < 48;
  const radius = compact ? Math.min(GAME_TILE_RADIUS, Math.round((size as number) * 0.27)) : GAME_TILE_RADIUS;
  return (
    <button
      type="button"
      {...rest}
      // No color transition: the selected state lands in the tap's frame
      // (founder, 2026-09-29); only the press scale animates.
      className={`relative flex flex-col items-center justify-center overflow-hidden transition-transform active:scale-[0.96] ${size == null ? 'w-full' : 'flex-shrink-0'} ${className}`}
      style={{
        ...gameTileSurface(accent, { selected, tone, radius }),
        // Fill mode: square by default, but stretch to the row so a square with a
        // two-line label never leaves its neighbors shorter.
        ...(size == null ? { aspectRatio: '1 / 1', alignSelf: 'stretch' } : { width: size, height: size }),
        padding: compact ? '4px 0 0' : '6px 4px 3px',
        gap: 2,
        ...style,
      }}
    >
      <GameTileBar accent={accent} radius={radius} />
      {children}
      {compact ? glyph : <GameTileChip accent={accent} width="min(32px, 56%)">{glyph}</GameTileChip>}
      {!compact && label != null && (
        // Up to two centered lines, no ellipsis ("Rock Paper Scissors" in the quick-play sheet).
        <span
          className="block w-full text-center text-[10px] font-extrabold"
          style={{ color: selected ? accent : t.text, lineHeight: '12px', maxHeight: 24, overflow: 'hidden', overflowWrap: 'break-word' }}
        >
          {label}
        </span>
      )}
    </button>
  );
}
