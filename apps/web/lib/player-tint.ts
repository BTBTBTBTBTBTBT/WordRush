import { AVATAR_BACKDROPS, avatarColorHex, resolveAvatar, type AvatarSource } from '@wordle-duel/core';
import type { HeadlinePaletteSpec } from '@/lib/live-headline';

// Founder 10-09: a person's name wears their own color, drawn from their mascot's backdrop (the Friends action menu's
// title in the bubble lettering). Mirrors iOS PlayerTint.nameColor and Android playerNameColor; keep the three in step.

const BRAND_PURPLE = '#8B5CF6';

function rgb(hex: string): [number, number, number] | null {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (h.length < 6 || !Number.isFinite(n)) return null;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function hsb2hex(h: number, s: number, v: number): string {
  const f = (n: number) => {
    const k = (n + h * 6) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase();
}

/**
 * A vivid version of the player's backdrop color: the backdrop's LAST color (the body color for "auto"), lifted to
 * saturation >= 0.78 and brightness >= 0.92 (lemon becomes a sunny gold); a gray or white backdrop (saturation < 0.12)
 * takes the brand purple.
 */
export function nameColorHex(bg: string | null | undefined, bodyColorId: string): string {
  const b = AVATAR_BACKDROPS.find((x) => x.id === bg);
  const hex = (b ? b.colors[b.colors.length - 1] : undefined) ?? avatarColorHex(bodyColorId);
  const c = rgb(hex);
  if (!c) return BRAND_PURPLE;
  const [r, g, bl] = c;
  const max = Math.max(r, g, bl);
  const min = Math.min(r, g, bl);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (sat < 0.12) return BRAND_PURPLE;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - bl) / d) % 6;
    else if (max === g) h = (bl - r) / d + 2;
    else h = (r - g) / d + 4;
    h = h / 6;
    if (h < 0) h += 1;
  }
  return hsb2hex(h, Math.max(sat, 0.78), Math.max(max, 0.92));
}

/** The name color for whoever this row describes (their saved look, worn cast hero or the seeded default). */
export function playerNameColor(src: AvatarSource): string {
  const c = resolveAvatar(src).config;
  return nameColorHex(c.bg, c.color);
}

/** The player's secondary color (their pattern color in the mascot maker): the glow behind their podium name. */
export function secondaryColorHex(patternColorId: string | null | undefined): string {
  return avatarColorHex(patternColorId ?? 'purple');
}

/**
 * The bubble lettering on a podium plate: purple letters + numbers with a white outline on a pale plate; white letters + gold
 * numbers (dark outline) on a dark one. Mirrors iOS PlayerTint.platePalette and Android PlaqueInk.palette.
 */
export function platePaletteSpec(lightInk: boolean): HeadlinePaletteSpec {
  return lightInk
    ? { top: '#FFFFFF', bottom: '#EDE9FE', deep: '#3B0764', nameTop: '#FFFFFF', nameBottom: '#EDE9FE', numberTop: '#FFE07A', numberBottom: '#F5A524', rim: '#4C1D95' }
    : { top: '#A855F7', bottom: '#6D28D9', deep: '#3B0764', nameTop: '#A855F7', nameBottom: '#6D28D9', numberTop: '#A855F7', numberBottom: '#6D28D9', rim: '#FFFFFF' };
}
