// FINISH_SPEC BJ5 (parity decision 10-03): share cards draw each player's
// RESOLVED avatar — a bot's cast art, a player's photo when it can be drawn
// (it loaded with CORS, so the canvas stays exportable), else their mascot
// (the code-drawn layered SVG, light look) — as a rounded square.

import type { AvatarConfig, AvatarFrame } from '@wordle-duel/core';
import { AVATAR_FRAME_COLOR, FRAME_WIDTH, avatarInitial, avatarRadiusPx, mascotSvg, portraitFrame, withAvatarId } from './avatar-render';
import { resolveRowAvatar, type AvatarRowFields } from './avatar-cast';
import { artSrc, badgeSrc } from './art';
import { roundRectPath } from './share-canvas';

export type ShareAvatar =
  | { kind: 'bot'; src: string }
  | { kind: 'player'; photoUrl: string | null; config: AvatarConfig; initial: string; level?: number | null; pro?: boolean | null };

/** A player's share avatar through the one resolver (BJ5 precedence). */
export function shareAvatarFor(
  row: AvatarRowFields | null | undefined,
  username: string | null | undefined,
  accent?: string | null,
  extra?: { level?: number | null; pro?: boolean | null },
): ShareAvatar {
  const r = resolveRowAvatar(row, username, accent);
  return { kind: 'player', photoUrl: r.photoUrl, config: r.config, initial: avatarInitial(username), level: extra?.level ?? null, pro: extra?.pro ?? null };
}

/** The mascot as a standalone SVG document `px` square (no art layers: an SVG image can't load them). */
export function shareMascotSvg(config: AvatarConfig, initial: string, px: number): string {
  const svg = mascotSvg({ config: { ...config, display: 'mascot' }, initial, size: px, frame: config.frame, crownSrc: badgeSrc('pro-crown-sprite'), artSrc });
  return withAvatarId(svg, 'share-av').replace('width="100%" height="100%"', `width="${px}" height="${px}"`);
}

function loadImg(src: string, cors: boolean, timeoutMs = 2500): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === 'undefined') { resolve(null); return; }
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    const timer = setTimeout(() => resolve(null), timeoutMs);
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = src;
  });
}

export interface LoadedShareAvatar {
  img: HTMLImageElement;
  /** Photos are clipped to the rounded square; mascots / bot art draw as they are. */
  clip: boolean;
  /** BJ6 photo rule: a photo is a framed portrait (never a face on a body). */
  frame?: AvatarFrame;
}

/** Loads what to draw for `avatar` at `px` (null = draw nothing). Never throws. */
export async function loadShareAvatar(avatar: ShareAvatar | null | undefined, px: number): Promise<LoadedShareAvatar | null> {
  if (!avatar) return null;
  try {
    if (avatar.kind === 'bot') {
      const img = await loadImg(avatar.src, false);
      return img ? { img, clip: false } : null;
    }
    if (avatar.photoUrl) {
      const photo = await loadImg(avatar.photoUrl, true);
      if (photo) return { img: photo, clip: true, frame: portraitFrame(avatar.config.frame, { pro: avatar.pro, level: avatar.level }) };
    }
    const svg = shareMascotSvg(avatar.config, avatar.initial, px);
    const img = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, false);
    return img ? { img, clip: false } : null;
  } catch {
    return null;
  }
}

/** Draws a loaded avatar in the `size` square at (x, y). */
export function drawShareAvatar(ctx: CanvasRenderingContext2D, a: LoadedShareAvatar, x: number, y: number, size: number): void {
  ctx.save();
  if (a.clip) {
    // The portrait's metal band (chosen frame, else the level's tier), then the photo inside it.
    const radius = avatarRadiusPx(size);
    let inset = 0;
    if (a.frame && a.frame !== 'none') {
      const m = AVATAR_FRAME_COLOR[a.frame];
      const band = ctx.createLinearGradient(x, y, x + size, y + size);
      band.addColorStop(0, m.shine);
      band.addColorStop(0.45, m.ring);
      band.addColorStop(1, m.ring);
      roundRectPath(ctx, x, y, size, size, radius);
      ctx.fillStyle = band;
      ctx.fill();
      inset = Math.max(1.5, (size * FRAME_WIDTH) / 100);
    }
    x += inset;
    y += inset;
    size -= inset * 2;
    roundRectPath(ctx, x, y, size, size, Math.max(2, radius - inset * 0.6));
    ctx.clip();
    // Cover-fit the photo.
    const w = a.img.naturalWidth || size;
    const h = a.img.naturalHeight || size;
    const k = Math.max(size / w, size / h);
    ctx.drawImage(a.img, x + (size - w * k) / 2, y + (size - h * k) / 2, w * k, h * k);
  } else {
    // Contain-fit (bot art isn't always square).
    const w = a.img.naturalWidth || size;
    const h = a.img.naturalHeight || size;
    const k = Math.min(size / w, size / h);
    ctx.drawImage(a.img, x + (size - w * k) / 2, y + (size - h * k) / 2, w * k, h * k);
  }
  ctx.restore();
}
