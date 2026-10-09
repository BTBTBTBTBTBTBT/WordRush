import { ADS_SERVING } from '@wordle-duel/core';

// FINISH_SPEC AA2 / AA3: the Pro identifier on avatars and the Settings member
// card. Pure bits (tested in pro-identity.test.ts); the components are
// components/ui/letter-tile-avatar.tsx (ProAvatarDecor), components/pro/pro-avatar.tsx
// and components/pro/pro-member-card.tsx. Android parity: ui/ProIdentity.kt.

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** "Member since October 2026" from profiles.created_at; null when absent or malformed. */
export function memberSince(createdAt: string | null | undefined): string | null {
  const s = createdAt?.trim();
  if (!s || s.length < 7 || s[4] !== '-') return null;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return null;
  return `Member since ${MONTHS[m - 1]} ${y}`;
}

/** The member card's plan line. */
export function proPlanLine({ webBilling }: { webBilling: boolean }): string {
  return webBilling ? 'Wordocious Pro · billed on wordocious.com' : (ADS_SERVING ? 'Wordocious Pro · every game unlimited, no ads' : 'Wordocious Pro · every game unlimited');
}

/**
 * AA2: whether an avatar shown for `name` gets the Pro decoration. An explicit
 * flag from the row data wins; otherwise (no backend row carries another
 * player's Pro state yet) only the signed-in Pro player's own avatar is crowned.
 */
export function isProAvatar(name: string | null | undefined, own: { username?: string | null; proActive: boolean }, explicit?: boolean | null): boolean {
  if (explicit != null) return explicit;
  if (!own.proActive) return false;
  const a = name?.trim().toLowerCase();
  const b = own.username?.trim().toLowerCase();
  return !!a && !!b && a === b;
}

/** AA2 measures: a thin gold ring just outside the avatar + the tiny crown (≈35%) on its top-right. */
export const PRO_AVATAR = {
  gold: '#f5a524',
  /** Gap between the avatar edge and the ring (px). */
  gap: 1.5,
  /** Ring stroke (px). */
  stroke: 1.75,
  /** The crown's size as a share of the avatar. */
  crownPct: 0.35,
  /** How far the crown pokes out past the right edge / above the top (share of the crown). */
  crownOutX: 0.32,
  crownOutY: 0.42,
  /** The crown's tilt (deg), leaning off the corner. */
  tilt: 12,
} as const;

export interface ProAvatarDecorLayout {
  /** The ring box, offset outward from the avatar box by `inset` px on every side. */
  ring: { inset: number; stroke: number; radius: number | '50%' };
  crown: { size: number; top: number; right: number };
}

/** The ring + crown boxes for an avatar of `size` px with corner `radius` (px, or 'circle' for photos). */
export function proAvatarDecor(size: number, radius: number | 'circle'): ProAvatarDecorLayout {
  const inset = PRO_AVATAR.gap + PRO_AVATAR.stroke;
  const c = Math.max(8, Math.round(size * PRO_AVATAR.crownPct));
  return {
    ring: { inset, stroke: PRO_AVATAR.stroke, radius: radius === 'circle' ? '50%' : radius + inset },
    crown: { size: c, top: -Math.round(c * PRO_AVATAR.crownOutY), right: -Math.round(c * PRO_AVATAR.crownOutX) },
  };
}
