/**
 * Profile personalization — the accent palette + helpers shared by the edit
 * modal and the profile display. The same 8-swatch palette is mirrored on iOS
 * (ProfilePersonalization.swift) and Android so a profile looks identical
 * everywhere. accent_color stores the hex; null = default brand purple.
 */

export interface AccentSwatch { id: string; hex: string }

export const ACCENT_COLORS: AccentSwatch[] = [
  { id: 'purple', hex: '#7C3AED' }, // default / "none"
  { id: 'blue', hex: '#2563EB' },
  { id: 'teal', hex: '#0D9488' },
  { id: 'green', hex: '#059669' },
  { id: 'amber', hex: '#D97706' },
  { id: 'pink', hex: '#EC4899' },
  { id: 'red', hex: '#DC2626' },
  { id: 'slate', hex: '#475569' },
];

export const DEFAULT_ACCENT = '#7C3AED';

/** Resolve a stored accent (hex or null) to a usable color, falling back to brand. */
export function resolveAccent(hex?: string | null): string {
  if (!hex) return DEFAULT_ACCENT;
  return ACCENT_COLORS.some((c) => c.hex.toLowerCase() === hex.toLowerCase()) ? hex : DEFAULT_ACCENT;
}

/** A slightly darker shade of an accent, for gradients (e.g. avatar fallback). */
export function accentDark(hex: string): string {
  const darker: Record<string, string> = {
    '#7C3AED': '#6D28D9', '#2563EB': '#1D4ED8', '#0D9488': '#0F766E', '#059669': '#047857',
    '#D97706': '#B45309', '#EC4899': '#BE185D', '#DC2626': '#B91C1C', '#475569': '#334155',
  };
  return darker[hex.toUpperCase()] ?? hex;
}
