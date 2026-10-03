'use client';

import * as React from 'react';
import type { AvatarConfig, AvatarFrame } from '@wordle-duel/core';

import { artSrc, badgeSrc } from '@/lib/art';
import {
  AVATAR_FRAME_COLOR, AVATAR_PARTS, FRAME_WIDTH, avatarArtNames, avatarConfigKey, avatarArtPending, avatarCrowned, avatarRadiusPx,
  cachedMascotSvg, clampAvatarSize, effectiveAvatarFrame, withAvatarId,
} from '@/lib/avatar-render';
import { darkenHex } from '@/lib/avatar-tile';
import { frameArtName, isAvatarFrame } from '@/lib/avatar-cast';
import { PRO_AVATAR, proAvatarDecor } from '@/lib/pro-identity';

/**
 * FINISH_SPEC AN1 / AN5 / AN6: the ONE web avatar renderer. A layered mascot
 * in the cast's glossy style wearing the player's INITIAL as its white body
 * letter (lib/avatar-render builds the SVG; memoized per config + size class),
 * or the player's photo as a rounded square — both inside the worn
 * rounded-square frame (none / bronze … diamond / Pro gold), with the AA2 gold
 * crown sprite on the top-right corner for Pro players. 16–200 px.
 * Decorative (aria-hidden) unless given a `label`.
 */
export interface MascotAvatarProps {
  config: AvatarConfig;
  /** The body letter (the player's initial). */
  initial: string;
  size: number;
  /** A photo replaces the mascot (rounded square, never a circle). */
  photoUrl?: string | null;
  /** The frame to wear (defaults to config.frame); clamped by `pro` / `level` (effectiveAvatarFrame). */
  frame?: AvatarFrame;
  /** True / false when the player's Pro state is known; null = unknown. */
  pro?: boolean | null;
  /** The player's level when known (a tier frame above it steps down). */
  level?: number | null;
  /** An accessible name; omit when the name is printed beside the avatar. */
  label?: string;
  /** Outer box-shadow (a presence / white ring) — follows the rounded corners. */
  shadow?: string;
  className?: string;
  style?: React.CSSProperties;
}

// ── Art probing (load-then-swap; never while the parts manifest is the placeholder) ──

const artProbe = new Map<string, Promise<boolean>>();
const artLoaded = new Set<string>();

function probeArt(name: string): Promise<boolean> {
  let p = artProbe.get(name);
  if (!p) {
    p = new Promise<boolean>((resolve) => {
      if (typeof Image === 'undefined') { resolve(false); return; }
      const im = new Image();
      im.onload = () => { artLoaded.add(name); resolve(true); };
      im.onerror = () => resolve(false);
      im.src = artSrc(name);
    });
    artProbe.set(name, p);
  }
  return p;
}

const NO_ART: ReadonlySet<string> = new Set();

/** The art-av-* parts of `config` that have loaded (empty while the art is pending). */
function useAvatarArt(config: AvatarConfig): ReadonlySet<string> {
  const pending = avatarArtPending();
  const ck = avatarConfigKey(config);
  const names = React.useMemo(() => {
    if (pending) return [] as string[];
    const all = avatarArtNames(config);
    const shipped = AVATAR_PARTS.art;
    return shipped ? all.filter((n) => shipped.includes(n)) : all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, ck]);
  const key = names.join(',');
  const initial = React.useMemo(() => {
    const have = names.filter((n) => artLoaded.has(n));
    return have.length ? new Set(have) : NO_ART;
  }, [names]);
  const [art, setArt] = React.useState<ReadonlySet<string>>(initial);
  React.useEffect(() => {
    if (!names.length) { setArt(NO_ART); return; }
    let alive = true;
    void Promise.all(names.map((n) => probeArt(n).then((ok) => (ok ? n : null)))).then((r) => {
      if (!alive) return;
      const have = r.filter((n): n is string => !!n);
      setArt(have.length ? new Set(have) : NO_ART);
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return art;
}

/** Whether the worn tier's art-frame-<tier> has loaded (bronze … diamond; never "none" / "pro"). */
function useFrameArt(worn: AvatarFrame): string | null {
  const name = isAvatarFrame(worn) ? frameArtName(worn) : null;
  const [ok, setOk] = React.useState(() => !!name && artLoaded.has(name));
  React.useEffect(() => {
    if (!name) { setOk(false); return; }
    if (artLoaded.has(name)) { setOk(true); return; }
    let alive = true;
    void probeArt(name).then((loaded) => { if (alive) setOk(loaded); });
    return () => { alive = false; };
  }, [name]);
  return ok ? name : null;
}

/** The tier frame art over the avatar (iOS AvatarFrameRing parity): fills the box, decorative. */
function FrameArt({ name, size }: { name: string; size: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={artSrc(name)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className="absolute inset-0 pointer-events-none select-none"
      style={{ width: size, height: size, maxWidth: 'none' }}
    />
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

/** AA2: the tiny gold crown sprite on the avatar's top-right corner (≈35%), tilted off the corner. */
export function ProCrown({ size }: { size: number }) {
  const c = proAvatarDecor(size, avatarRadiusPx(size)).crown;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={badgeSrc('pro-crown-sprite')}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      width={c.size}
      height={c.size}
      draggable={false}
      className="absolute pointer-events-none select-none"
      style={{
        width: c.size, height: c.size, top: c.top, right: c.right, zIndex: 1, maxWidth: 'none',
        transform: `rotate(${PRO_AVATAR.tilt}deg)`, filter: 'drop-shadow(0 1px 1.5px rgba(146, 64, 14, 0.35))',
      }}
    />
  );
}

/** AN6: a photo as a rounded square inside the worn frame (metal band + inner shine). */
function PhotoTile({ url, size, frame, onError }: { url: string; size: number; frame: AvatarFrame; onError: () => void }) {
  const radius = avatarRadiusPx(size);
  const img = (inset: number, r: number) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={onError}
      className="absolute object-cover"
      style={{ left: inset, top: inset, width: size - inset * 2, height: size - inset * 2, borderRadius: r, maxWidth: 'none' }}
    />
  );
  if (frame === 'none') {
    return (
      <span className="absolute inset-0 overflow-hidden" style={{ borderRadius: radius, background: '#efe9ff' }}>
        {img(0, radius)}
      </span>
    );
  }
  const m = AVATAR_FRAME_COLOR[frame];
  const fw = Math.max(1.5, (size * FRAME_WIDTH) / 100);
  const inner = Math.max(2, radius - fw * 0.6);
  return (
    <span
      className="absolute inset-0"
      style={{
        borderRadius: radius,
        background: `linear-gradient(135deg, ${m.shine} 0%, ${m.ring} 45%, ${darkenHex(m.ring, 0.22)} 100%)`,
        boxShadow: `inset 0 0 0 ${Math.max(0.75, size * 0.011)}px ${darkenHex(m.ring, 0.3)}88`,
      }}
    >
      {img(fw, inner)}
      <span
        aria-hidden="true"
        className="absolute pointer-events-none"
        style={{ left: fw - 0.5, top: fw - 0.5, right: fw - 0.5, bottom: fw - 0.5, borderRadius: inner, boxShadow: `inset 0 0 0 1px ${m.shine}` }}
      />
    </span>
  );
}

// ── The avatar ──────────────────────────────────────────────────────────────

function MascotAvatarImpl({ config, initial, size, photoUrl, frame, pro, level, label, shadow, className = '', style }: MascotAvatarProps) {
  const s = clampAvatarSize(size);
  const worn = effectiveAvatarFrame(frame ?? config.frame, { pro, level });
  const crowned = avatarCrowned(worn, pro);
  const art = useAvatarArt(config);
  const frameArt = useFrameArt(worn);
  const rawId = React.useId();
  const id = `m${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [photoFailed, setPhotoFailed] = React.useState(false);
  React.useEffect(() => { setPhotoFailed(false); }, [photoUrl]);
  const showPhoto = !!photoUrl && !photoFailed;

  const markup = React.useMemo(
    () => (showPhoto ? '' : withAvatarId(cachedMascotSvg({ config, initial, size: s, frame: worn, art, frameArt: !!frameArt, crownSrc: badgeSrc('pro-crown-sprite'), artSrc }), id)),
    [showPhoto, config, initial, s, worn, art, frameArt, id],
  );

  return (
    <span
      className={`relative inline-block shrink-0 select-none ${className}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: s, height: s, borderRadius: avatarRadiusPx(s), boxShadow: shadow, ...style }}
    >
      {showPhoto
        ? <PhotoTile url={photoUrl!} size={s} frame={worn} onError={() => setPhotoFailed(true)} />
        : <span className="absolute inset-0 block" dangerouslySetInnerHTML={{ __html: markup }} />}
      {frameArt && <FrameArt name={frameArt} size={s} />}
      {crowned && <ProCrown size={s} />}
    </span>
  );
}

/** Memoized: rows re-render often; the avatar only when its inputs change. */
export const MascotAvatar = React.memo(MascotAvatarImpl);
