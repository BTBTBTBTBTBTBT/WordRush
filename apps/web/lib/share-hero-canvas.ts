'use client';

// The share card's HERO BAND (FRIDAY-QUEUE item 46; pure rules in core share-hero.ts): the sender's own mascot, big,
// posed by the result: a glow disc behind it (gold for a flawless, orange in the Halloween season), the mascot in the
// living-mascot pose (cheer / jump / shrug / wave) drawn by the same resolver the app uses (code-drawn layered SVG, light
// look; a photo avatar is drawn as its framed portrait), and the little 3D crown over a winner's head.

import { avatarPoseDef, shareHeroSpec, type ShareHeroResult, type ShareHeroSpec } from '@wordle-duel/core';
import { avatarInitial, mascotSvg, withAvatarId } from './avatar-render';
import { artSrc, badgeSrc } from './art';
import { loadShareImage, roundRectPath } from './share-canvas';
import type { ShareAvatar } from './share-avatar';

export interface ShareHeroArt {
  spec: ShareHeroSpec;
  /** The posed mascot / photo / bot art (null = nothing loaded: the band stays empty, never a placeholder). */
  img: HTMLImageElement | null;
  /** Photos draw as a rounded portrait; the mascot draws as it is. */
  photo: boolean;
  crown: HTMLImageElement | null;
}

/** The band's art for `avatar` at `result` (never throws; every image is optional). */
export async function loadShareHero(avatar: ShareAvatar, result: ShareHeroResult, halloween: boolean, px: number): Promise<ShareHeroArt> {
  const spec = shareHeroSpec(result, halloween);
  const crown = spec.crown ? loadShareImage(['/icons3d/crown.png']) : Promise.resolve(null);
  let img: HTMLImageElement | null = null;
  let photo = false;
  try {
    if (avatar.kind === 'bot') {
      img = await loadShareImage([avatar.src]);
    } else if (avatar.photoUrl) {
      img = await loadShareImage([avatar.photoUrl]);
      photo = !!img;
    }
    if (!img && avatar.kind === 'player') {
      const pose = { id: spec.pose, spec: avatarPoseDef(spec.pose) ?? {} };
      const svg = withAvatarId(
        mascotSvg({
          config: { ...avatar.config, display: 'mascot' }, initial: avatar.initial || avatarInitial(''), size: px, frame: avatar.config.frame,
          crownSrc: badgeSrc('pro-crown-sprite'), artSrc, pose,
        }),
        'share-hero',
      ).replace('width="100%" height="100%"', `width="${px}" height="${px}"`);
      img = await loadShareImage([`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`]);
    }
  } catch {
    img = null;
  }
  return { spec, img, photo, crown: await crown };
}

/** Draws the band in [top, top + h) centered on `cx`: glow, then the mascot, then the crown. */
export function drawShareHero(ctx: CanvasRenderingContext2D, hero: ShareHeroArt, cx: number, top: number, h: number): void {
  if (!hero.img) return;
  const { spec } = hero;
  const cy = top + h / 2;
  // The glow: a soft radial, plus a gold ring on a flawless.
  const r = h * 0.62;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, hexA(spec.glow, 0.55));
  g.addColorStop(0.6, hexA(spec.glow, 0.18));
  g.addColorStop(1, hexA(spec.glow, 0));
  ctx.fillStyle = g;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  if (spec.gold) {
    ctx.save();
    ctx.strokeStyle = hexA('#F59E0B', 0.85);
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(cx, cy, h * 0.47, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  const size = h * 0.9;
  if (hero.photo) {
    ctx.save();
    roundRectPath(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.22);
    ctx.clip();
    const k = Math.max(size / hero.img.naturalWidth, size / hero.img.naturalHeight);
    ctx.drawImage(hero.img, cx - (hero.img.naturalWidth * k) / 2, cy - (hero.img.naturalHeight * k) / 2, hero.img.naturalWidth * k, hero.img.naturalHeight * k);
    ctx.restore();
  } else {
    const k = Math.min(size / hero.img.naturalWidth, size / hero.img.naturalHeight);
    ctx.drawImage(hero.img, cx - (hero.img.naturalWidth * k) / 2, cy - (hero.img.naturalHeight * k) / 2, hero.img.naturalWidth * k, hero.img.naturalHeight * k);
  }
  if (hero.crown) {
    const c = h * 0.3;
    ctx.save();
    ctx.translate(cx + size * 0.12, top + c * 0.2);
    ctx.rotate(-0.12);
    ctx.drawImage(hero.crown, -c / 2, 0, c, c * (hero.crown.naturalHeight / Math.max(1, hero.crown.naturalWidth)));
    ctx.restore();
  }
}

function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  return `rgba(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}, ${a})`;
}
