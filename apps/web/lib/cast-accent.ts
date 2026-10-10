import type { CastColor } from '@/components/ui/cast-button';

/**
 * Founder 10-09: a button that wears a game's color takes the family cast color nearest the game's accent HUE
 * (low saturation = slate). Mirrored by iOS YourBoardPill.castColor and Android castColorForAccent; keep the three in step.
 * `hex` is `#rgb` or `#rrggbb`.
 */
export function castColorForAccent(hex: string): CastColor {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return 'gold';
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const sat = max === 0 ? 0 : d / max;
  if (sat < 0.18) return 'slate';
  let deg = 0;
  if (d > 0) {
    if (max === r) deg = ((g - b) / d) % 6;
    else if (max === g) deg = (b - r) / d + 2;
    else deg = (r - g) / d + 4;
    deg *= 60;
    if (deg < 0) deg += 360;
  }
  if (deg < 18 || deg >= 335) return 'pink';
  if (deg < 40) return 'orange';
  if (deg < 62) return 'gold';
  if (deg < 150) return 'green';
  if (deg < 190) return 'teal';
  if (deg < 245) return 'blue';
  if (deg < 300) return 'purple';
  return 'pink';
}

/**
 * Founder 10-10: the hue turn (degrees) that takes the purple candy art (hue ~262) to a game accent, so controls built from
 * the candy sprites wear the selected game's color. 0 for a low-saturation accent. Mirrors iOS GameHue.shift and Android gameHueShift.
 */
export function gameHueShift(hex: string): number {
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (!Number.isFinite(n) || h.length < 6) return 0;
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  const sat = max === 0 ? 0 : d / max;
  if (sat <= 0.18) return 0;
  let deg = 0;
  if (d > 0) {
    if (max === r) deg = ((g - b) / d) % 6;
    else if (max === g) deg = (b - r) / d + 2;
    else deg = (r - g) / d + 4;
    deg *= 60;
    if (deg < 0) deg += 360;
  }
  let delta = deg - 262;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return Math.round(delta);
}
