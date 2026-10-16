// FINISH_SPEC BJ5 (parity decision 10-03): share cards draw each player's
// RESOLVED avatar — a bot's cast art, a player's photo when it can be drawn
// (it loaded with CORS, so the canvas stays exportable), else their mascot
// (the code-drawn layered SVG, light look) — as a rounded square.

import { avatarPlacePose, podiumWinnerHead, type AvatarConfig, type AvatarFrame } from '@wordle-duel/core';
import { AVATAR_FRAME_COLOR, AVATAR_PARTS, FRAME_WIDTH, avatarArtName, avatarArtNames, avatarInitial, avatarRadiusPx, mascotSvg, portraitFrame, withAvatarId } from './avatar-render';
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

const dataUrls = new Map<string, string>();

/** An art piece as a data: URL (an SVG drawn as an <img> can't fetch /art files, but it can read data: ones). */
function artDataUrl(name: string, img: HTMLImageElement): string | null {
  const hit = dataUrls.get(name);
  if (hit) return hit;
  try {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    const g = c.getContext('2d');
    if (!g || !c.width || !c.height) return null;
    g.drawImage(img, 0, 0);
    const url = c.toDataURL('image/png');
    dataUrls.set(name, url);
    return url;
  } catch {
    return null;
  }
}

/**
 * The podium's standing mascot (founder 10-16): the player's REAL layered mascot (body, face, hat... art files), the same
 * living layout MascotAvatar draws, as a full-body cutout (no tile, no frame), posed by its step (1st cheers, 2nd claps,
 * 3rd waves) with the crown hat on 1st (core podiumWinnerHead). Every layer's art is loaded first, then inlined into the
 * mascot SVG as a data: URL so the browser composes it (tints, pattern, pose) exactly like the app. A bot draws its cast
 * art. Null when it can't be drawn (the podium then leaves the step empty).
 */
export async function loadPodiumMascot(avatar: ShareAvatar | null | undefined, step: 1 | 2 | 3, px: number): Promise<HTMLImageElement | null> {
  if (!avatar) return null;
  if (avatar.kind === 'bot') return loadImg(avatar.src, false);
  try {
    const config = { ...avatar.config, display: 'mascot', pose: avatarPlacePose(step), ...(step === 1 ? { head: podiumWinnerHead(avatar.config.head) } : null) } as AvatarConfig;
    const shipped = AVATAR_PARTS.art;
    const names = [...new Set([...avatarArtNames(config, true), ...avatarArtNames(config), avatarArtName('body', config.body)])].filter((n) => !shipped || shipped.includes(n));
    const loaded = await Promise.all(names.map((n) => loadImg(artSrc(n), false, 4000)));
    const art = new Set<string>();
    const urls = new Map<string, string>();
    names.forEach((n, i) => {
      const img = loaded[i];
      const url = img ? artDataUrl(n, img) : null;
      if (url) { art.add(n); urls.set(n, url); }
    });
    let svg = mascotSvg({ config, initial: avatar.initial, size: px, frame: 'none', art, cutout: true, live: true, crownSrc: badgeSrc('pro-crown-sprite'), artSrc });
    svg = withAvatarId(svg, 'share-pod').replace('width="100%" height="100%"', `width="${px}" height="${px}"`);
    for (const [n, url] of urls) svg = svg.split(`href="${artSrc(n)}"`).join(`href="${url}"`);
    svg = svg.split('font-family="inherit"').join('font-family="system-ui, -apple-system, Helvetica, sans-serif"');
    return await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, false, 6000);
  } catch {
    return null;
  }
}
