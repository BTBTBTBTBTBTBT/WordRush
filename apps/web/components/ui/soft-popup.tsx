import Image from 'next/image';
import type { CSSProperties } from 'react';
import { ART_SIZE, artSrc, type PoseArtName } from '@/lib/art';
import { alphaHex, cardBarStyle, softBackground, softBorder, softPill, SOFT } from '@/lib/soft-surface';
import { SoftNum } from '@/components/ui/soft-number';

// The finishing build's popup / sheet / form kit (docs/FINISH_SPEC.md A1, A7,
// G1–G5): every window, sheet, toast, form field and settings row takes a soft
// wash of its accent (never plain white) and windows wear the game-card top
// bar. Built on lib/soft-surface.ts so dark mode keeps its dark surfaces (the
// washes lie over var(--color-card-base)). No hooks: renders anywhere.

/** The soft page dim behind a window (a purple-tinted shade, not black). */
export const POPUP_DIM = 'rgba(30, 15, 60, 0.45)';

/** The window shadow. */
export const POPUP_SHADOW = '0 24px 60px rgba(40, 15, 80, 0.3)';

/** Brand accents the popups use. */
export const POPUP_ACCENT = {
  brand: '#7c3aed',
  gold: '#f5a524',
  pink: '#ec4899',
  teal: '#0d9488',
  peach: '#fb923c',
  red: '#e11d48',
} as const;

/**
 * A window / sheet card: the accent's wash over the card base, its soft
 * border, a big radius and the soft window shadow. `overflow: hidden` so a
 * <PopupBar/> follows the corners.
 */
export function popupCard(accent: string, { radius = 24, share = SOFT.tint }: { radius?: number; share?: number } = {}): CSSProperties {
  return {
    background: softBackground(accent, share),
    border: softBorder(accent, share),
    borderRadius: radius,
    boxShadow: POPUP_SHADOW,
    overflow: 'hidden',
  };
}

/** The 10 px game-card top bar across a window / card (A1). */
export function PopupBar({ accent, gradient, height = SOFT.bar }: { accent: string; gradient?: string; height?: number }) {
  return <div aria-hidden="true" className="shrink-0" style={gradient ? { height, background: gradient } : cardBarStyle(accent, height)} />;
}

/** A tinted row / tile inside a window (settings rows, menu rows, option cards). */
export function softRow(accent: string, { selected = false, radius = 16 }: { selected?: boolean; radius?: number } = {}): CSSProperties {
  const share = selected ? SOFT.strong : 0.09;
  return {
    background: softBackground(accent, share),
    border: selected ? `2px solid ${accent}` : softBorder(accent, share),
    borderRadius: radius,
    boxShadow: selected ? `0 0 0 3px ${alphaHex(accent, 0.18)}` : `0 2px 8px ${alphaHex(accent, 0.08)}`,
  };
}

/** A tinted text field (A1: inputs take the wash too). `invalid` draws the red edge. */
export function softInput(accent: string = POPUP_ACCENT.brand, { invalid = false }: { invalid?: boolean } = {}): CSSProperties {
  return {
    background: softBackground(accent, 0.07),
    border: invalid ? '1.5px solid #f87171' : softBorder(accent, 0.07),
    borderRadius: 14,
    color: 'var(--color-text)',
  };
}

/** A soft notice box (errors, "check your email"): tinted, never white. */
export function softNotice(kind: 'error' | 'success' | 'info'): CSSProperties {
  const accent = kind === 'error' ? '#e11d48' : kind === 'success' ? '#059669' : POPUP_ACCENT.brand;
  return {
    background: softBackground(accent, 0.1),
    border: softBorder(accent, 0.1),
    borderRadius: 14,
    color: kind === 'error' ? 'var(--color-loss-text, #be123c)' : 'var(--color-text)',
  };
}

/**
 * A cast pose (art-pose-*, 320 px square) for a secondary spot (A7: a
 * different character than the page / game host). Decorative.
 */
export function PoseArt({ pose, size, className = '', style, priority = false }: {
  pose: PoseArtName;
  size: number;
  className?: string;
  style?: CSSProperties;
  priority?: boolean;
}) {
  const [w, h] = ART_SIZE[pose];
  return (
    <Image
      src={artSrc(pose)}
      alt=""
      aria-hidden="true"
      width={w}
      height={h}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      sizes={`${size}px`}
      className={`block shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}

/** A soft section label inside a window (replaces the gray `.section-header`). */
export function SoftSectionLabel({ children, ink = '#6d28d9', className = '' }: { children: React.ReactNode; ink?: string; className?: string }) {
  return (
    <div className={`font-black uppercase soft-section-label ${className}`} style={{ fontSize: 11, letterSpacing: '0.12em', color: ink }}>
      {children}
    </div>
  );
}

/**
 * A full-screen state's card (loading failed, 404, error, gates): the
 * accent's wash with its top bar, centered content. Server-safe.
 */
export function StateCard({ accent = POPUP_ACCENT.brand, gradient, children, className = '', style }: {
  accent?: string;
  gradient?: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={`w-full max-w-sm text-center ${className}`} style={{ ...popupCard(accent, { share: 0.12 }), boxShadow: `0 14px 36px ${alphaHex(accent, 0.18)}`, ...style }}>
      <PopupBar accent={accent} gradient={gradient} />
      <div className="px-6 pt-5 pb-5">{children}</div>
    </div>
  );
}

/** The brand bar gradient (violet → pink → gold) the app's windows wear. */
export const BRAND_BAR = 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)';

/** A soft-number stat tile (A2) for windows and overlays: the accent's tinted pill, the big soft number, a small tracked label. */
export function SoftStatTile({ value, label, accent = POPUP_ACCENT.brand, size = 22 }: { value: React.ReactNode; label: string; accent?: string; size?: number }) {
  return (
    <div className="text-center min-w-0" style={{ ...softPill(accent, { radius: 14 }), padding: '9px 6px 7px' }}>
      <SoftNum size={size} as="b" className="block whitespace-nowrap soft-num-auto">{value}</SoftNum>
      <span className="block mt-1 text-[10px] font-black uppercase leading-tight" style={{ letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>{label}</span>
    </div>
  );
}

/**
 * A padded form / auth card with its accent top bar drawn as an inset band
 * (follows the radius, no extra element, keeps the card's own padding): the
 * accent's wash, the soft border and a soft accent shadow.
 */
export function barCard(accent: string = POPUP_ACCENT.brand, { radius = 24, share = 0.1, bar = SOFT.bar }: { radius?: number; share?: number; bar?: number } = {}): CSSProperties {
  return {
    background: softBackground(accent, share),
    border: softBorder(accent, share),
    borderRadius: radius,
    boxShadow: `inset 0 ${bar}px 0 ${accent}, 0 10px 28px ${alphaHex(accent, 0.14)}`,
  };
}
