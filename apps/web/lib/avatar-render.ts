// Build-your-own-mascot avatars (docs/FINISH_SPEC.md AN1, AN5, AN6): the pure
// half of the ONE web renderer (components/avatar/mascot-avatar.tsx). Turns an
// AvatarConfig + the player's initial into an SVG string in a 100×100 box:
//
//   stage / frame back → cape (behind) → body (tinted, lip, arms, feet) →
//   pattern (clipped to the body) → gloss → body letter (the INITIAL, white,
//   Nunito 900, embossed) → cheeks / nose → eyes → mouth → bow tie / flower →
//   face accessory → head accessory → front frame
//
// Positions come from the per-body anchors in packages/core/src/avatar-parts.json
// (0–1 body coordinates; a placeholder until the art-av-* art lands). Every part
// is code-drawn until its art file exists; then the caller passes the loaded
// names in `art` and the part is drawn from `art-av-<kind>-<id>.webp` instead
// (the white body is tinted by a multiply filter so the gloss survives).
// Sizes ≤ 28 px drop the pattern and every accessory except hats (AN5).
// Shared by every avatar on the page, so the markup is cached per
// config + size class (`cachedMascotSvg`); element ids carry a placeholder
// token the component swaps for its own unique id.

import {
  AVATAR_BACKDROPS, AVATAR_BACKDROP_IDS, AVATAR_BODIES, AVATAR_COLORS, AVATAR_EYES, AVATAR_FACES, AVATAR_FRAMES,
  AVATAR_HEADS, AVATAR_MOUTHS, AVATAR_NECKS, AVATAR_NOSES, AVATAR_PATTERNS, AVATAR_PRO_ONLY, avatarColorHex, levelTier,
  type AvatarBody, type AvatarConfig, type AvatarFrame, type AvatarHead,
} from '@wordle-duel/core';
import partsJson from '../../../packages/core/src/avatar-parts.json';
import { darkenHex, hexAlpha, lightenHex } from './avatar-tile';

// ── Shape constants ─────────────────────────────────────────────────────────

/** Corner radius of every avatar tile, photo and frame (AN6: rounded square, never a circle). */
export const AVATAR_RADIUS = 0.22;

/** Corner radius in px for an avatar of `size`. */
export function avatarRadiusPx(size: number): number {
  return Math.round(size * AVATAR_RADIUS * 100) / 100;
}

/** AN5: at or below this size the pattern and every accessory except hats are dropped. */
export const SMALL_AVATAR_MAX = 28;

export function isSmallAvatar(size: number): boolean {
  return size <= SMALL_AVATAR_MAX;
}

/** Clamp a requested size to the supported 16–200 range. */
export function clampAvatarSize(size: number): number {
  if (!Number.isFinite(size)) return 40;
  return Math.max(16, Math.min(200, Math.round(size)));
}

/** The frame band's width in the 100-unit box. */
export const FRAME_WIDTH = 6;

// ── The manifest ────────────────────────────────────────────────────────────

export interface BodyAnchors {
  faceCenter: [number, number];
  eyeY: number;
  mouthY: number;
  cheekY: number;
  headTop: { x: number; y: number; w: number };
  neckY: number;
  letterBox: [number, number, number, number];
}

interface PartsManifest {
  version?: number;
  placeholder?: boolean;
  /** Optional list of shipped art names (art-av-*) — when present, only these are tried. */
  art?: string[];
  bodies: Record<string, BodyAnchors>;
  parts: Record<'eyes' | 'mouth' | 'nose' | 'head' | 'face' | 'neck', { slot: string; scale: number }>;
}

export const AVATAR_PARTS = partsJson as unknown as PartsManifest;

/** True while avatar-parts.json is the placeholder (no art-av-* art shipped yet: never probe for it). */
export function avatarArtPending(manifest: PartsManifest = AVATAR_PARTS): boolean {
  return manifest.placeholder === true;
}

export function bodyAnchors(body: AvatarBody, manifest: PartsManifest = AVATAR_PARTS): BodyAnchors {
  return manifest.bodies[body] ?? manifest.bodies.classic;
}

function partScale(kind: keyof PartsManifest['parts'], manifest: PartsManifest = AVATAR_PARTS): number {
  return manifest.parts[kind]?.scale ?? 0.5;
}

// ── Geometry ────────────────────────────────────────────────────────────────

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Each body's box in the 100-unit tile. All stand on the same floor (bottom
 * ≈ 86–88) with room above for a hat and below for the feet + ground shadow.
 */
export const BODY_BOX: Record<AvatarBody, Box> = {
  classic: { x: 18, y: 25, w: 64, h: 62 },
  tall: { x: 25, y: 16, w: 50, h: 72 },
  wide: { x: 12, y: 33, w: 76, h: 54 },
  blob: { x: 17, y: 24, w: 66, h: 63 },
  bean: { x: 21, y: 20, w: 58, h: 67 },
  star: { x: 14, y: 19, w: 72, h: 68 },
};

/** A point given in 0–1 body coordinates → the 100-unit tile. */
export function bodyPoint(body: AvatarBody, ax: number, ay: number): { x: number; y: number } {
  const b = BODY_BOX[body];
  return { x: b.x + ax * b.w, y: b.y + ay * b.h };
}

export interface PartSpot { x: number; y: number; w: number }

export interface AvatarGeometry {
  box: Box;
  eyes: PartSpot;
  nose: PartSpot;
  mouth: PartSpot;
  /** Glasses / mustache (the mustache sits between nose and mouth). */
  face: PartSpot;
  /** Hat: x center, y = the hat's bottom edge, w = its width. */
  head: PartSpot;
  neck: PartSpot;
  /** The body letter: center x, baseline y, font size; `box` = the letter box. */
  letter: { x: number; baseline: number; fontSize: number; box: Box };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Where every part goes for `config`, from the body's anchors (pure; tested). */
export function avatarGeometry(config: Pick<AvatarConfig, 'body' | 'neck'>, { small = false }: { small?: boolean } = {}, manifest: PartsManifest = AVATAR_PARTS): AvatarGeometry {
  const body = (AVATAR_BODIES as readonly string[]).includes(config.body) ? config.body : 'classic';
  const box = BODY_BOX[body];
  const a = bodyAnchors(body, manifest);
  const fx = box.x + a.faceCenter[0] * box.w;
  const y = (v: number) => box.y + v * box.h;
  const [lx, ly, lw, lh] = a.letterBox;
  // A bow tie / scarf / chain sits at the top of the letter box: the letter steps down under it.
  const tieShift = !small && FRONT_NECKS.includes(config.neck) ? 0.07 : 0;
  const letterBox: Box = { x: box.x + lx * box.w, y: y(ly + tieShift), w: lw * box.w, h: (lh - tieShift) * box.h };
  // Nunito 900 caps ≈ 0.72 em tall and up to ≈ 0.9 em wide (W): fit both, a touch inside the box.
  const fontSize = Math.min(letterBox.h / 0.74, letterBox.w / 0.9) * 0.94;
  const noseY = y(a.cheekY);
  const mouthY = y(a.mouthY);
  return {
    box,
    eyes: { x: fx, y: y(a.eyeY), w: partScale('eyes', manifest) * box.w },
    nose: { x: fx, y: noseY, w: partScale('nose', manifest) * box.w },
    mouth: { x: fx, y: mouthY, w: partScale('mouth', manifest) * box.w },
    face: { x: fx, y: y(a.eyeY), w: partScale('face', manifest) * box.w },
    head: { x: box.x + a.headTop.x * box.w, y: y(a.headTop.y), w: a.headTop.w * box.w * partScale('head', manifest) },
    neck: { x: fx, y: y(a.neckY), w: partScale('neck', manifest) * box.w },
    letter: { x: letterBox.x + letterBox.w / 2, baseline: letterBox.y + letterBox.h / 2 + fontSize * 0.36, fontSize, box: letterBox },
  };
}

// ── Layers ──────────────────────────────────────────────────────────────────

/** Neck / back extras drawn behind the body (cape, wings) and in front of it (bow tie, scarf, chain). */
export const BACK_NECKS: readonly string[] = ['cape', 'wings'];
export const FRONT_NECKS: readonly string[] = ['bowtie', 'scarf', 'chain'];

export type AvatarLayer =
  | 'frameBack' | 'stage' | 'neckBack' | 'body' | 'pattern' | 'gloss' | 'letter'
  | 'nose' | 'eyes' | 'mouth' | 'neckFront' | 'face' | 'head' | 'frameFront';

/** The layers drawn for `config` at `size`, back → front (AN1; ≤ 28 px keeps only hats among the extras). */
export function avatarLayers(config: AvatarConfig, size: number, frame: AvatarFrame = config.frame): AvatarLayer[] {
  const small = isSmallAvatar(size);
  const out: AvatarLayer[] = [];
  const framed = frame !== 'none';
  if (framed) out.push('frameBack');
  out.push('stage');
  if (!small && BACK_NECKS.includes(config.neck)) out.push('neckBack');
  out.push('body');
  if (!small && config.pattern !== 'solid') out.push('pattern');
  out.push('gloss', 'letter');
  if (config.nose !== 'none' && !(small && config.nose === 'freckles')) out.push('nose');
  out.push('eyes', 'mouth');
  if (!small && FRONT_NECKS.includes(config.neck)) out.push('neckFront');
  if (!small && config.face !== 'none') out.push('face');
  if (config.head !== 'none') out.push('head');
  if (framed) out.push('frameFront');
  return out;
}

// ── Frames (AN6) ────────────────────────────────────────────────────────────

/** Frame metal: main band + the inner shine (bronze → diamond match lib/avatar-cast FRAME_COLOR). */
export const AVATAR_FRAME_COLOR: Record<Exclude<AvatarFrame, 'none'>, { ring: string; shine: string }> = {
  bronze: { ring: '#c47a3a', shine: '#f3c08f' },
  silver: { ring: '#94a3b8', shine: '#eef2f7' },
  gold: { ring: '#f2b01e', shine: '#fff1b8' },
  platinum: { ring: '#5fb8c9', shine: '#dff7fb' },
  diamond: { ring: '#6d8dfc', shine: '#e6ecff' },
  pro: { ring: '#f5a524', shine: '#ffe7a3' },
};

const TIER_FRAMES = ['bronze', 'silver', 'gold', 'platinum'] as const;

/**
 * The frame an avatar actually wears: Pro players wear the gold Pro frame when
 * they picked none (AA2 → AN6); a known free player loses the Pro-only frames
 * (diamond, pro); a tier frame above a known level's tier steps down to it.
 * Unknown Pro state / level → the stored pick as is.
 */
export function effectiveAvatarFrame(frame: AvatarFrame, { pro, level }: { pro?: boolean | null; level?: number | null } = {}): AvatarFrame {
  let f = frame;
  if (pro === false && (f === 'pro' || f === 'diamond')) f = 'none';
  if (pro === true && f === 'none') f = 'pro';
  if (level != null && Number.isFinite(level) && (TIER_FRAMES as readonly string[]).includes(f)) {
    const order = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
    const top = order.indexOf(levelTier(level));
    if (order.indexOf(f) > top) f = order[top] as AvatarFrame;
  }
  return f;
}

/** The AA2 crown sprite rides on the avatar when the player is Pro or wears the Pro frame. */
export function avatarCrowned(frame: AvatarFrame, pro?: boolean | null): boolean {
  return pro === true || (pro !== false && frame === 'pro');
}

// ── The initial ─────────────────────────────────────────────────────────────

/** The ONE body letter: the name's first letter or digit, uppercased ("?" when none). */
export function avatarInitial(name: string | null | undefined): string {
  for (const ch of Array.from((name ?? '').trim())) {
    if (/[\p{L}\p{N}]/u.test(ch)) return ch.toLocaleUpperCase();
  }
  return '?';
}

// ── Art names ───────────────────────────────────────────────────────────────

export type AvatarArtKind = 'body' | 'eyes' | 'mouth' | 'nose' | 'acc';

export function avatarArtName(kind: AvatarArtKind, id: string): string {
  return `art-av-${kind}-${id}`;
}

/** The art names a config would use (nothing for "none" picks). */
export function avatarArtNames(config: AvatarConfig): string[] {
  const out = [avatarArtName('body', config.body), avatarArtName('eyes', config.eyes), avatarArtName('mouth', config.mouth)];
  if (config.nose !== 'none') out.push(avatarArtName('nose', config.nose));
  for (const acc of [config.head, config.face, config.neck]) if (acc !== 'none') out.push(avatarArtName('acc', acc));
  return out;
}

// ── Colors ──────────────────────────────────────────────────────────────────

const INK = '#2a1745';

export interface AvatarPalette { base: string; light: string; dark: string; edge: string; pattern: string; stageIn: string; stageOut: string }

export function avatarPalette(config: Pick<AvatarConfig, 'color' | 'patternColor'>): AvatarPalette {
  const base = avatarColorHex(config.color);
  // A pattern in the body's own color would vanish: use a light tint of it instead.
  const pattern = config.patternColor && config.patternColor !== config.color ? avatarColorHex(config.patternColor) : lightenHex(base, 0.5);
  return {
    base,
    light: lightenHex(base, 0.3),
    dark: darkenHex(base, 0.14),
    edge: darkenHex(base, 0.32),
    pattern,
    stageIn: lightenHex(base, 0.88),
    stageOut: lightenHex(base, 0.7),
  };
}

// ── SVG building blocks ─────────────────────────────────────────────────────

/** The id placeholder in cached markup; the component swaps it for a unique id. */
export const MASCOT_ID_TOKEN = '__MID__';
const ID = MASCOT_ID_TOKEN;

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** The body outline for `body` in the 100-unit tile (pure; tested for every shape). */
export function bodyPath(body: AvatarBody): string {
  const b = BODY_BOX[body];
  const P = (u: number, v: number) => `${r2(b.x + u * b.w)},${r2(b.y + v * b.h)}`;
  const rect = (rx: number) => {
    const r = Math.min(rx, b.w / 2, b.h / 2);
    const x0 = b.x, y0 = b.y, x1 = b.x + b.w, y1 = b.y + b.h;
    return `M${r2(x0 + r)},${r2(y0)} H${r2(x1 - r)} Q${r2(x1)},${r2(y0)} ${r2(x1)},${r2(y0 + r)} V${r2(y1 - r)} Q${r2(x1)},${r2(y1)} ${r2(x1 - r)},${r2(y1)} H${r2(x0 + r)} Q${r2(x0)},${r2(y1)} ${r2(x0)},${r2(y1 - r)} V${r2(y0 + r)} Q${r2(x0)},${r2(y0)} ${r2(x0 + r)},${r2(y0)} Z`;
  };
  switch (body) {
    case 'classic': return rect(Math.min(b.w, b.h) * 0.3);
    case 'tall': return rect(b.w * 0.42);
    case 'wide': return rect(b.h * 0.4);
    case 'blob':
      return `M${P(0.52, 0)} C${P(0.86, 0.02)} ${P(1.01, 0.26)} ${P(0.99, 0.54)} C${P(0.98, 0.84)} ${P(0.8, 1)} ${P(0.5, 1)} C${P(0.18, 1)} ${P(0.01, 0.86)} ${P(0.01, 0.56)} C${P(0.01, 0.22)} ${P(0.2, -0.02)} ${P(0.52, 0)} Z`;
    case 'bean':
      return `M${P(0.56, 0)} C${P(0.86, 0)} ${P(1, 0.2)} ${P(0.98, 0.44)} C${P(0.97, 0.6)} ${P(0.9, 0.68)} ${P(0.95, 0.8)} C${P(1, 0.95)} ${P(0.84, 1)} ${P(0.6, 1)} L${P(0.4, 1)} C${P(0.14, 1)} ${P(0, 0.86)} ${P(0, 0.6)} C${P(0, 0.38)} ${P(0.1, 0.3)} ${P(0.13, 0.22)} C${P(0.18, 0.06)} ${P(0.34, 0)} ${P(0.56, 0)} Z`;
    case 'star': {
      // A chubby five-point star, every corner rounded (quadratic through the midpoints).
      const cx = b.x + b.w / 2, cy = b.y + b.h * 0.54;
      const ro = b.w / 2, ri = b.w * 0.33;
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? ro : ri;
        pts.push([cx + r * Math.cos(ang), cy + r * Math.sin(ang) * (b.h / b.w) * 1.02]);
      }
      const mid = (p: [number, number], q: [number, number]) => `${r2((p[0] + q[0]) / 2)},${r2((p[1] + q[1]) / 2)}`;
      let d = `M${mid(pts[9], pts[0])}`;
      for (let i = 0; i < 10; i++) {
        const p = pts[i], q = pts[(i + 1) % 10];
        d += ` Q${r2(p[0])},${r2(p[1])} ${mid(p, q)}`;
      }
      return `${d} Z`;
    }
  }
}

function heart(x: number, y: number, k: number, fill: string, stroke?: string): string {
  return `<path transform="translate(${r2(x)} ${r2(y)}) scale(${r2(k)})" d="M0,1.4 C-2.7,-0.5 -2.9,-2.6 -1.5,-3.1 C-0.7,-3.4 0,-2.8 0,-2.2 C0,-2.8 0.7,-3.4 1.5,-3.1 C2.9,-2.6 2.7,-0.5 0,1.4 Z" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="0.35"` : ''}/>`;
}

function star(x: number, y: number, ro: number, ri: number, fill: string, stroke?: string, sw = 0): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? ro : ri;
    pts.push(`${r2(x + r * Math.cos(ang))},${r2(y + r * Math.sin(ang))}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="${r2(sw)}" stroke-linejoin="round"` : ''}/>`;
}

function sparkle(x: number, y: number, r: number, fill: string): string {
  const k = r * 0.28;
  return `<path d="M${r2(x)},${r2(y - r)} Q${r2(x + k)},${r2(y - k)} ${r2(x + r)},${r2(y)} Q${r2(x + k)},${r2(y + k)} ${r2(x)},${r2(y + r)} Q${r2(x - k)},${r2(y + k)} ${r2(x - r)},${r2(y)} Q${r2(x - k)},${r2(y - k)} ${r2(x)},${r2(y - r)} Z" fill="${fill}"/>`;
}

function line(d: string, w: number, color = INK): string {
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${r2(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

// ── Code-drawn parts (placeholders until the art lands) ─────────────────────

function drawEyes(id: AvatarConfig['eyes'], s: PartSpot): string {
  const u = s.w / 30;
  const d = s.w * 0.32;
  const beady = (x: number) =>
    `<ellipse cx="${r2(x)}" cy="${r2(s.y)}" rx="${r2(2.6 * u)}" ry="${r2(3.3 * u)}" fill="${INK}"/><circle cx="${r2(x + 0.8 * u)}" cy="${r2(s.y - 1.1 * u)}" r="${r2(0.9 * u)}" fill="#ffffff"/>`;
  const arc = (x: number) => line(`M${r2(x - 3 * u)},${r2(s.y + 1 * u)} Q${r2(x)},${r2(s.y - 3.6 * u)} ${r2(x + 3 * u)},${r2(s.y + 1 * u)}`, 1.9 * u);
  const L = s.x - d, R = s.x + d;
  switch (id) {
    case 'beady': return beady(L) + beady(R);
    case 'happy': return arc(L) + arc(R);
    case 'sparkly': {
      const one = (x: number) =>
        `<ellipse cx="${r2(x)}" cy="${r2(s.y)}" rx="${r2(3.6 * u)}" ry="${r2(4.4 * u)}" fill="${INK}"/><circle cx="${r2(x + 1.1 * u)}" cy="${r2(s.y - 1.5 * u)}" r="${r2(1.4 * u)}" fill="#ffffff"/><circle cx="${r2(x - 1.2 * u)}" cy="${r2(s.y + 1.6 * u)}" r="${r2(0.7 * u)}" fill="#ffffff"/>`;
      return one(L) + one(R);
    }
    case 'sleepy': {
      const one = (x: number) =>
        `<path d="M${r2(x - 3 * u)},${r2(s.y)} A${r2(3 * u)},${r2(2.6 * u)} 0 0 0 ${r2(x + 3 * u)},${r2(s.y)} Z" fill="${INK}"/>${line(`M${r2(x - 3.4 * u)},${r2(s.y)} L${r2(x + 3.4 * u)},${r2(s.y)}`, 1.4 * u)}`;
      return one(L) + one(R);
    }
    case 'wink': return beady(L) + arc(R);
    case 'hearts': return heart(L, s.y + 0.6 * u, 1.35 * u, '#ef3e6d') + heart(R, s.y + 0.6 * u, 1.35 * u, '#ef3e6d');
    case 'stars': return star(L, s.y, 3.6 * u, 1.6 * u, '#f5b301', '#c98a00', 0.5 * u) + star(R, s.y, 3.6 * u, 1.6 * u, '#f5b301', '#c98a00', 0.5 * u);
    case 'glasses': {
      const lens = (x: number) => `<circle cx="${r2(x)}" cy="${r2(s.y)}" r="${r2(4.6 * u)}" fill="rgba(255,255,255,0.28)" stroke="${INK}" stroke-width="${r2(1.3 * u)}"/>`;
      return beady(L) + beady(R) + lens(L) + lens(R) + line(`M${r2(L + 4.6 * u)},${r2(s.y - 0.6 * u)} Q${r2(s.x)},${r2(s.y - 2.2 * u)} ${r2(R - 4.6 * u)},${r2(s.y - 0.6 * u)}`, 1.2 * u);
    }
    case 'cyclops':
      return `<circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="${r2(6.2 * u)}" fill="#ffffff" stroke="${INK}" stroke-width="${r2(0.9 * u)}"/><circle cx="${r2(s.x)}" cy="${r2(s.y + 0.4 * u)}" r="${r2(3.4 * u)}" fill="${INK}"/><circle cx="${r2(s.x + 1.2 * u)}" cy="${r2(s.y - 0.9 * u)}" r="${r2(1.2 * u)}" fill="#ffffff"/>`;
  }
}

function drawNose(id: AvatarConfig['nose'], s: PartSpot, eyes: PartSpot, pal: AvatarPalette): string {
  const u = s.w / 32;
  const cheekX = eyes.w * 0.42;
  switch (id) {
    case 'none': return '';
    case 'button': return `<ellipse cx="${r2(s.x)}" cy="${r2(s.y)}" rx="${r2(1.7 * u)}" ry="${r2(1.15 * u)}" fill="${darkenHex(pal.base, 0.5)}" opacity="0.75"/>`;
    case 'red': return `<circle cx="${r2(s.x)}" cy="${r2(s.y)}" r="${r2(3.1 * u)}" fill="#ef4444"/><circle cx="${r2(s.x + 1 * u)}" cy="${r2(s.y - 1 * u)}" r="${r2(1 * u)}" fill="#ffffff" opacity="0.7"/>`;
    case 'blush':
      return [-1, 1].map((k) => `<ellipse cx="${r2(s.x + k * cheekX)}" cy="${r2(s.y + 0.8 * u)}" rx="${r2(3.6 * u)}" ry="${r2(2.2 * u)}" fill="#ff7aa8" opacity="0.6"/>`).join('');
    case 'freckles':
      return [-1, 1].map((k) => [[-1.8, -0.6], [0, 0.9], [1.8, -0.4]]
        .map(([dx, dy]) => `<circle cx="${r2(s.x + k * cheekX + dx * u)}" cy="${r2(s.y + dy * u)}" r="${r2(0.75 * u)}" fill="${darkenHex(pal.base, 0.5)}" opacity="0.7"/>`).join('')).join('');
  }
}

function drawMouth(id: AvatarConfig['mouth'], s: PartSpot): string {
  const u = s.w / 16.6;
  const { x, y } = s;
  const P = (dx: number, dy: number) => `${r2(x + dx * u)},${r2(y + dy * u)}`;
  const tongueFill = '#ff6f91';
  switch (id) {
    case 'smile': return line(`M${P(-4, -0.5)} Q${P(0, 4)} ${P(4, -0.5)}`, 1.7 * u);
    case 'grin':
      return `<path d="M${P(-5, -1)} Q${P(0, 7)} ${P(5, -1)} Z" fill="${INK}"/><ellipse cx="${r2(x)}" cy="${r2(y + 2.3 * u)}" rx="${r2(2.2 * u)}" ry="${r2(1.1 * u)}" fill="${tongueFill}"/>`;
    case 'tongue':
      return `<path d="M${P(-1.8, 1)} Q${P(-1.9, 5.2)} ${P(0, 5.2)} Q${P(1.9, 5.2)} ${P(1.8, 1)} Z" fill="${tongueFill}" stroke="${INK}" stroke-width="${r2(0.8 * u)}"/>${line(`M${P(-4, -0.5)} Q${P(0, 3.6)} ${P(4, -0.5)}`, 1.7 * u)}`;
    case 'o': return `<ellipse cx="${r2(x)}" cy="${r2(y + 1 * u)}" rx="${r2(2 * u)}" ry="${r2(2.5 * u)}" fill="${INK}"/>`;
    case 'cat': return line(`M${P(-4, 0)} Q${P(-2, 3)} ${P(0, 0)} Q${P(2, 3)} ${P(4, 0)}`, 1.6 * u);
    case 'toothy':
      return `<path d="M${P(-5, -1)} Q${P(0, 7)} ${P(5, -1)} Z" fill="${INK}"/><path d="M${P(-4.5, -0.75)} L${P(4.5, -0.75)} L${P(3.9, 1.3)} L${P(-3.9, 1.3)} Z" fill="#ffffff"/>`;
    case 'smirk': return line(`M${P(-3.5, 1)} Q${P(1, 2.6)} ${P(4, -1.4)}`, 1.7 * u);
    case 'tiny': return line(`M${P(-2, 0)} Q${P(0, 2)} ${P(2, 0)}`, 1.5 * u);
    case 'gasp':
      return `<ellipse cx="${r2(x)}" cy="${r2(y + 1.5 * u)}" rx="${r2(3 * u)}" ry="${r2(3.8 * u)}" fill="${INK}"/><ellipse cx="${r2(x)}" cy="${r2(y + 3.6 * u)}" rx="${r2(1.8 * u)}" ry="${r2(1 * u)}" fill="${tongueFill}"/>`;
  }
}

function drawFace(id: AvatarConfig['face'], g: AvatarGeometry): string {
  const s = g.face;
  const u = s.w / 36;
  switch (id) {
    case 'none': return '';
    case 'heart-glasses': {
      const d = g.eyes.w * 0.32;
      return heart(s.x - d, s.y + 1.4 * u, 2.2 * u, 'rgba(255,79,139,0.92)', '#b8104a') + heart(s.x + d, s.y + 1.4 * u, 2.2 * u, 'rgba(255,79,139,0.92)', '#b8104a')
        + line(`M${r2(s.x - d + 5 * u)},${r2(s.y - 2.2 * u)} L${r2(s.x + d - 5 * u)},${r2(s.y - 2.2 * u)}`, 1.1 * u, '#b8104a')
        + line(`M${r2(s.x - d - 5.6 * u)},${r2(s.y - 2.6 * u)} L${r2(s.x - s.w * 0.5)},${r2(s.y - 3.4 * u)}`, 1.1 * u, '#b8104a')
        + line(`M${r2(s.x + d + 5.6 * u)},${r2(s.y - 2.6 * u)} L${r2(s.x + s.w * 0.5)},${r2(s.y - 3.4 * u)}`, 1.1 * u, '#b8104a');
    }
    case 'monocle': {
      const d = g.eyes.w * 0.32;
      const x = s.x + d, r = 4.6 * u * (36 / 30) * (g.eyes.w / s.w) * (s.w / 36) * (30 / g.eyes.w) * 1.0;
      const rr = Math.max(r, g.eyes.w * 0.17);
      return `<circle cx="${r2(x)}" cy="${r2(s.y)}" r="${r2(rr)}" fill="rgba(255,255,255,0.22)" stroke="#d4a017" stroke-width="${r2(1.3 * u)}"/>${line(`M${r2(x + rr * 0.7)},${r2(s.y + rr * 0.7)} Q${r2(x + rr * 1.3)},${r2(s.y + rr * 2.2)} ${r2(x + rr * 0.6)},${r2(s.y + rr * 3.4)}`, 0.7 * u, '#d4a017')}`;
    }
    case 'mustache': {
      const x = s.x;
      const y = g.nose.y + (g.mouth.y - g.nose.y) * 0.5;
      const P = (dx: number, dy: number) => `${r2(x + dx * u)},${r2(y + dy * u)}`;
      return `<path d="M${P(0, 0)} C${P(-2, -2)} ${P(-7, -2.2)} ${P(-8.4, 1.4)} C${P(-6, 0.4)} ${P(-3, 2)} ${P(0, 0.7)} C${P(3, 2)} ${P(6, 0.4)} ${P(8.4, 1.4)} C${P(7, -2.2)} ${P(2, -2)} ${P(0, 0)} Z" fill="#4a2c1a"/>`;
    }
  }
}

function tieColor(base: string): string {
  // Red bow tie, or blue on a red / pink / orange body.
  const n = parseInt(base.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return r > 180 && g < 140 && b < 170 ? '#2563eb' : '#e11d48';
}

function drawNeckBack(id: AvatarConfig['neck'], g: AvatarGeometry): string {
  const b = g.box;
  if (id === 'wings') {
    // Two soft feathered wings peeking out behind the body's shoulders.
    const wy = b.y + b.h * 0.42;
    const wing = (k: number) => {
      const x0 = b.x + b.w * (k < 0 ? 0.12 : 0.88);
      const P = (dx: number, dy: number) => `${r2(x0 + k * dx * b.w)},${r2(wy + dy * b.h)}`;
      return `<path d="M${P(0, -0.08)} C${P(0.2, -0.3)} ${P(0.42, -0.26)} ${P(0.4, -0.02)} C${P(0.34, 0.02)} ${P(0.34, 0.08)} ${P(0.3, 0.1)} C${P(0.26, 0.16)} ${P(0.2, 0.18)} ${P(0.14, 0.18)} C${P(0.08, 0.22)} ${P(0.02, 0.2)} ${P(0, 0.14)} Z" fill="#f5f3ff" stroke="#c4b5fd" stroke-width="0.8" stroke-linejoin="round"/>`;
    };
    return wing(-1) + wing(1);
  }
  const top = b.y + b.h * 0.34;
  return `<path d="M${r2(b.x + b.w * 0.2)},${r2(top)} L${r2(b.x + b.w * 0.8)},${r2(top)} L${r2(b.x + b.w * 1.1)},${r2(b.y + b.h + 2)} L${r2(b.x - b.w * 0.1)},${r2(b.y + b.h + 2)} Z" fill="url(#${ID}-cape)"/>`;
}

function drawNeckFront(id: AvatarConfig['neck'], g: AvatarGeometry, pal: AvatarPalette): string {
  const b = g.box;
  if (id === 'bowtie') {
    const x = g.letter.box.x + g.letter.box.w / 2;
    const y = g.letter.box.y - b.h * 0.03;
    const w = b.w * 0.15;
    const h = b.h * 0.06;
    const c = tieColor(pal.base);
    return `<path d="M${r2(x)},${r2(y)} L${r2(x - w)},${r2(y - h)} L${r2(x - w)},${r2(y + h)} Z M${r2(x)},${r2(y)} L${r2(x + w)},${r2(y - h)} L${r2(x + w)},${r2(y + h)} Z" fill="${c}" stroke="${darkenHex(c, 0.3)}" stroke-width="0.6" stroke-linejoin="round"/><circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(h * 0.55)}" fill="${darkenHex(c, 0.15)}"/>`;
  }
  if (id === 'scarf') {
    // A knitted band across the neck with one tail hanging over the shoulder.
    const y = g.letter.box.y - b.h * 0.035;
    const h = b.h * 0.075;
    const c = tieColor(pal.base) === '#e11d48' ? '#14b8a6' : '#f97316';
    return `<path d="M${r2(b.x + b.w * 0.06)},${r2(y - h / 2)} Q${r2(b.x + b.w / 2)},${r2(y + h * 0.5)} ${r2(b.x + b.w * 0.94)},${r2(y - h / 2)} L${r2(b.x + b.w * 0.94)},${r2(y + h / 2)} Q${r2(b.x + b.w / 2)},${r2(y + h * 1.5)} ${r2(b.x + b.w * 0.06)},${r2(y + h / 2)} Z" fill="${c}" stroke="${darkenHex(c, 0.25)}" stroke-width="0.6"/><rect x="${r2(b.x + b.w * 0.66)}" y="${r2(y + h * 0.3)}" width="${r2(b.w * 0.11)}" height="${r2(b.h * 0.2)}" rx="${r2(b.w * 0.03)}" transform="rotate(-8 ${r2(b.x + b.w * 0.7)} ${r2(y)})" fill="${c}" stroke="${darkenHex(c, 0.25)}" stroke-width="0.6"/>`;
  }
  if (id === 'chain') {
    // A gold chain draped across the chest with a round medallion.
    const y = g.letter.box.y - b.h * 0.04;
    const x0 = b.x + b.w * 0.2, x1 = b.x + b.w * 0.8, xm = b.x + b.w / 2;
    const r = b.w * 0.055;
    return `${line(`M${r2(x0)},${r2(y - b.h * 0.05)} Q${r2(xm)},${r2(y + b.h * 0.06)} ${r2(x1)},${r2(y - b.h * 0.05)}`, b.w * 0.022, '#d4a017')}<circle cx="${r2(xm)}" cy="${r2(y + r * 0.6)}" r="${r2(r)}" fill="#facc15" stroke="#b7791f" stroke-width="0.6"/><circle cx="${r2(xm - r * 0.3)}" cy="${r2(y + r * 0.3)}" r="${r2(r * 0.3)}" fill="#fff7cc" opacity="0.8"/>`;
  }
  return '';
}

function drawHead(id: AvatarHead, g: AvatarGeometry, crownSrc: string, pal: AvatarPalette): string {
  const { x, y, w } = g.head;
  const P = (dx: number, dy: number) => `${r2(x + dx * w)},${r2(y + dy * w)}`;
  switch (id) {
    case 'none': return '';
    case 'crown': {
      const s = w * 0.86;
      return `<image href="${esc(crownSrc)}" x="${r2(x - s / 2)}" y="${r2(y - s * 0.78)}" width="${r2(s)}" height="${r2(s)}" transform="rotate(-8 ${r2(x)} ${r2(y - s * 0.3)})" preserveAspectRatio="xMidYMid meet"/>`;
    }
    case 'nightcap':
      return `<path d="M${P(-0.48, 0)} C${P(-0.42, -0.52)} ${P(0.12, -0.78)} ${P(0.66, -0.4)} C${P(0.32, -0.36)} ${P(0.3, -0.12)} ${P(0.48, 0)} Z" fill="#3b82f6"/><rect x="${r2(x - 0.52 * w)}" y="${r2(y - 0.1 * w)}" width="${r2(1.04 * w)}" height="${r2(0.15 * w)}" rx="${r2(0.07 * w)}" fill="#ffffff"/><circle cx="${r2(x + 0.68 * w)}" cy="${r2(y - 0.4 * w)}" r="${r2(0.1 * w)}" fill="#ffffff"/>`;
    case 'sweatband':
      return `<rect x="${r2(x - 0.52 * w)}" y="${r2(y + 0.02 * w)}" width="${r2(1.04 * w)}" height="${r2(0.15 * w)}" rx="${r2(0.07 * w)}" fill="#ef4444"/><rect x="${r2(x - 0.52 * w)}" y="${r2(y + 0.075 * w)}" width="${r2(1.04 * w)}" height="${r2(0.04 * w)}" fill="#ffffff" opacity="0.85"/>`;
    case 'sprout':
      return `${line(`M${P(0, 0.04)} Q${P(0.03, -0.16)} ${P(0, -0.3)}`, 0.05 * w, '#15803d')}<ellipse cx="${r2(x - 0.13 * w)}" cy="${r2(y - 0.33 * w)}" rx="${r2(0.15 * w)}" ry="${r2(0.07 * w)}" transform="rotate(25 ${r2(x - 0.13 * w)} ${r2(y - 0.33 * w)})" fill="#22c55e"/><ellipse cx="${r2(x + 0.13 * w)}" cy="${r2(y - 0.35 * w)}" rx="${r2(0.15 * w)}" ry="${r2(0.07 * w)}" transform="rotate(-25 ${r2(x + 0.13 * w)} ${r2(y - 0.35 * w)})" fill="#4ade80"/>`;
    case 'beanie':
      return `<path d="M${P(-0.5, 0.04)} C${P(-0.5, -0.56)} ${P(0.5, -0.56)} ${P(0.5, 0.04)} Z" fill="#f97316"/><rect x="${r2(x - 0.53 * w)}" y="${r2(y - 0.1 * w)}" width="${r2(1.06 * w)}" height="${r2(0.17 * w)}" rx="${r2(0.07 * w)}" fill="#c2410c"/><circle cx="${r2(x)}" cy="${r2(y - 0.46 * w)}" r="${r2(0.1 * w)}" fill="#fed7aa"/>`;
    case 'bow': {
      const bx = x + 0.28 * w, by = y + 0.02 * w;
      return `<ellipse cx="${r2(bx - 0.13 * w)}" cy="${r2(by)}" rx="${r2(0.15 * w)}" ry="${r2(0.09 * w)}" transform="rotate(-20 ${r2(bx - 0.13 * w)} ${r2(by)})" fill="#ec4899"/><ellipse cx="${r2(bx + 0.13 * w)}" cy="${r2(by)}" rx="${r2(0.15 * w)}" ry="${r2(0.09 * w)}" transform="rotate(20 ${r2(bx + 0.13 * w)} ${r2(by)})" fill="#ec4899"/><circle cx="${r2(bx)}" cy="${r2(by)}" r="${r2(0.06 * w)}" fill="#be185d"/>`;
    }
    case 'headphones': {
      const b = g.box;
      const cy = g.eyes.y;
      const cupW = Math.max(4, 0.16 * w), cupH = 0.3 * w;
      const lx = b.x - cupW * 0.35, rx = b.x + b.w + cupW * 0.35;
      return `${line(`M${r2(lx)},${r2(cy - cupH * 0.4)} C${r2(lx)},${r2(y - 0.5 * w)} ${r2(rx)},${r2(y - 0.5 * w)} ${r2(rx)},${r2(cy - cupH * 0.4)}`, 0.07 * w, '#475569')}<rect x="${r2(lx - cupW / 2)}" y="${r2(cy - cupH / 2)}" width="${r2(cupW)}" height="${r2(cupH)}" rx="${r2(cupW * 0.45)}" fill="#334155"/><rect x="${r2(rx - cupW / 2)}" y="${r2(cy - cupH / 2)}" width="${r2(cupW)}" height="${r2(cupH)}" rx="${r2(cupW * 0.45)}" fill="#334155"/>`;
    }
    case 'wizard':
      return `<path d="M${P(-0.46, 0)} L${P(0.08, -0.66)} L${P(0.46, 0)} Z" fill="#6d28d9"/><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(0.62 * w)}" ry="${r2(0.1 * w)}" fill="#5b21b6"/>${star(x - 0.06 * w, y - 0.3 * w, 0.07 * w, 0.03 * w, '#facc15')}${star(x + 0.14 * w, y - 0.14 * w, 0.05 * w, 0.022 * w, '#fde68a')}`;
    case 'party':
      return `<path d="M${P(-0.3, 0.02)} L${P(0.06, -0.6)} L${P(0.32, 0.02)} Z" fill="#facc15"/>${line(`M${P(-0.2, -0.16)} L${P(0.24, -0.09)}`, 0.06 * w, '#ec4899')}${line(`M${P(-0.08, -0.36)} L${P(0.15, -0.31)}`, 0.05 * w, '#ec4899')}<circle cx="${r2(x + 0.06 * w)}" cy="${r2(y - 0.6 * w)}" r="${r2(0.07 * w)}" fill="#ec4899"/>`;
    case 'pirate':
      return `<path d="M${P(-0.6, 0.02)} C${P(-0.5, -0.5)} ${P(0.5, -0.5)} ${P(0.6, 0.02)} C${P(0.3, -0.1)} ${P(-0.3, -0.1)} ${P(-0.6, 0.02)} Z" fill="#1f2937"/><circle cx="${r2(x)}" cy="${r2(y - 0.24 * w)}" r="${r2(0.07 * w)}" fill="#ffffff"/>`;
    case 'cowboy':
      return `<path d="M${P(-0.34, 0)} C${P(-0.4, -0.5)} ${P(-0.1, -0.44)} ${P(0, -0.37)} C${P(0.1, -0.44)} ${P(0.4, -0.5)} ${P(0.34, 0)} Z" fill="#b45309"/><rect x="${r2(x - 0.35 * w)}" y="${r2(y - 0.12 * w)}" width="${r2(0.7 * w)}" height="${r2(0.07 * w)}" fill="#78350f"/><ellipse cx="${r2(x)}" cy="${r2(y + 0.01 * w)}" rx="${r2(0.72 * w)}" ry="${r2(0.11 * w)}" fill="#92400e"/>`;
    case 'chef':
      return `<rect x="${r2(x - 0.36 * w)}" y="${r2(y - 0.3 * w)}" width="${r2(0.72 * w)}" height="${r2(0.32 * w)}" rx="${r2(0.05 * w)}" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.6"/><circle cx="${r2(x - 0.24 * w)}" cy="${r2(y - 0.36 * w)}" r="${r2(0.19 * w)}" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.6"/><circle cx="${r2(x + 0.24 * w)}" cy="${r2(y - 0.36 * w)}" r="${r2(0.19 * w)}" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.6"/><circle cx="${r2(x)}" cy="${r2(y - 0.44 * w)}" r="${r2(0.22 * w)}" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.6"/>`;
    case 'grad':
      return `<rect x="${r2(x - 0.3 * w)}" y="${r2(y - 0.26 * w)}" width="${r2(0.6 * w)}" height="${r2(0.28 * w)}" rx="${r2(0.04 * w)}" fill="#111827"/><path d="M${P(-0.62, -0.3)} L${P(0, -0.5)} L${P(0.62, -0.3)} L${P(0, -0.12)} Z" fill="#1f2937"/>${line(`M${P(0, -0.31)} L${P(0.46, -0.22)} L${P(0.46, -0.04)}`, 0.03 * w, '#facc15')}`;
    case 'flower': {
      const fx = x + 0.3 * w, fy = y + 0.02 * w, r = 0.09 * w;
      let petals = '';
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
        petals += `<circle cx="${r2(fx + Math.cos(a) * r * 1.15)}" cy="${r2(fy + Math.sin(a) * r * 1.15)}" r="${r2(r)}" fill="#f9a8d4" stroke="#db2777" stroke-width="0.4"/>`;
      }
      return `${petals}<circle cx="${r2(fx)}" cy="${r2(fy)}" r="${r2(r * 0.8)}" fill="#facc15"/>`;
    }
    case 'tophat':
      return `<rect x="${r2(x - 0.32 * w)}" y="${r2(y - 0.6 * w)}" width="${r2(0.64 * w)}" height="${r2(0.6 * w)}" rx="${r2(0.04 * w)}" fill="#1f2937"/><rect x="${r2(x - 0.32 * w)}" y="${r2(y - 0.17 * w)}" width="${r2(0.64 * w)}" height="${r2(0.09 * w)}" fill="#e11d48"/><ellipse cx="${r2(x)}" cy="${r2(y)}" rx="${r2(0.55 * w)}" ry="${r2(0.08 * w)}" fill="#111827"/>`;
    case 'propeller':
      return `<path d="M${P(-0.46, 0.03)} C${P(-0.46, -0.46)} ${P(0.46, -0.46)} ${P(0.46, 0.03)} Z" fill="#2563eb"/><path d="M${P(-0.12, -0.32)} C${P(-0.1, -0.12)} ${P(-0.1, -0.04)} ${P(-0.12, 0.03)} L${P(0.12, 0.03)} C${P(0.1, -0.04)} ${P(0.1, -0.12)} ${P(0.12, -0.32)} Z" fill="#facc15"/>${line(`M${P(0, -0.33)} L${P(0, -0.47)}`, 0.035 * w, '#475569')}<ellipse cx="${r2(x - 0.17 * w)}" cy="${r2(y - 0.49 * w)}" rx="${r2(0.17 * w)}" ry="${r2(0.05 * w)}" fill="#ef4444"/><ellipse cx="${r2(x + 0.17 * w)}" cy="${r2(y - 0.49 * w)}" rx="${r2(0.17 * w)}" ry="${r2(0.05 * w)}" fill="#22c55e"/><circle cx="${r2(x)}" cy="${r2(y - 0.49 * w)}" r="${r2(0.045 * w)}" fill="#475569"/>`;
    case 'catears': {
      const ear = (k: number) => `<path d="M${P(k * 0.46, 0.08)} L${P(k * 0.36, -0.34)} L${P(k * 0.08, 0.04)} Z" fill="${pal.base}" stroke="${pal.edge}" stroke-width="0.6" stroke-linejoin="round"/><path d="M${P(k * 0.38, 0.03)} L${P(k * 0.33, -0.2)} L${P(k * 0.18, 0.02)} Z" fill="#fda4af"/>`;
      return ear(-1) + ear(1);
    }
    case 'bunnyears': {
      const ear = (k: number) => {
        const cx = x + k * 0.2 * w, cy = y - 0.3 * w;
        return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(0.1 * w)}" ry="${r2(0.3 * w)}" transform="rotate(${k * 10} ${r2(cx)} ${r2(cy)})" fill="#ffffff" stroke="#e5e7eb" stroke-width="0.6"/><ellipse cx="${r2(cx)}" cy="${r2(cy + 0.02 * w)}" rx="${r2(0.05 * w)}" ry="${r2(0.21 * w)}" transform="rotate(${k * 10} ${r2(cx)} ${r2(cy)})" fill="#fbcfe8"/>`;
      };
      return ear(-1) + ear(1);
    }
    case 'tiara':
      return `<path d="M${P(-0.4, 0.02)} L${P(-0.3, -0.18)} L${P(-0.15, -0.07)} L${P(0, -0.3)} L${P(0.15, -0.07)} L${P(0.3, -0.18)} L${P(0.4, 0.02)} Z" fill="#e5e7eb" stroke="#94a3b8" stroke-width="0.6" stroke-linejoin="round"/><circle cx="${r2(x)}" cy="${r2(y - 0.2 * w)}" r="${r2(0.05 * w)}" fill="#ec4899"/><circle cx="${r2(x - 0.28 * w)}" cy="${r2(y - 0.1 * w)}" r="${r2(0.03 * w)}" fill="#60a5fa"/><circle cx="${r2(x + 0.28 * w)}" cy="${r2(y - 0.1 * w)}" r="${r2(0.03 * w)}" fill="#60a5fa"/>`;
    case 'viking': {
      const horn = (k: number) => `<path d="M${P(k * 0.4, -0.1)} Q${P(k * 0.8, -0.12)} ${P(k * 0.7, -0.56)} Q${P(k * 0.6, -0.26)} ${P(k * 0.34, -0.26)} Z" fill="#fef3c7" stroke="#d6b77a" stroke-width="0.6" stroke-linejoin="round"/>`;
      return `${horn(-1)}${horn(1)}<path d="M${P(-0.48, 0.04)} C${P(-0.48, -0.5)} ${P(0.48, -0.5)} ${P(0.48, 0.04)} Z" fill="#94a3b8"/><rect x="${r2(x - 0.5 * w)}" y="${r2(y - 0.06 * w)}" width="${r2(w)}" height="${r2(0.12 * w)}" rx="${r2(0.05 * w)}" fill="#d4a017"/>`;
    }
    case 'halo':
      return `<ellipse cx="${r2(x)}" cy="${r2(y - 0.28 * w)}" rx="${r2(0.42 * w)}" ry="${r2(0.1 * w)}" fill="none" stroke="#facc15" stroke-width="${r2(0.07 * w)}"/><ellipse cx="${r2(x)}" cy="${r2(y - 0.28 * w)}" rx="${r2(0.42 * w)}" ry="${r2(0.1 * w)}" fill="none" stroke="#fef3c7" stroke-width="${r2(0.025 * w)}"/>`;
  }
}

function drawPattern(config: AvatarConfig, g: AvatarGeometry): string {
  const b = g.box;
  const fill = `url(#${ID}-pg)`;
  switch (config.pattern) {
    case 'solid': return '';
    case 'twotone': return `<rect x="${r2(b.x - 2)}" y="${r2(b.y + b.h * 0.56)}" width="${r2(b.w + 4)}" height="${r2(b.h * 0.5)}" fill="${fill}"/>`;
    case 'stripes': {
      let out = '';
      for (let i = 0; i < 5; i++) out += `<rect x="${r2(b.x - 2)}" y="${r2(b.y + b.h * (0.1 + i * 0.2))}" width="${r2(b.w + 4)}" height="${r2(b.h * 0.08)}" fill="${fill}"/>`;
      return out;
    }
    case 'dots': {
      let out = '';
      const r = b.w * 0.05;
      for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 6; col++) {
          const cx = b.x + b.w * (0.06 + col * 0.19 + (row % 2 ? 0.095 : 0));
          const cy = b.y + b.h * (0.1 + row * 0.2);
          out += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(r)}" fill="${fill}"/>`;
        }
      }
      return out;
    }
    case 'gradient': return `<rect x="${r2(b.x - 2)}" y="${r2(b.y - 2)}" width="${r2(b.w + 4)}" height="${r2(b.h + 4)}" fill="url(#${ID}-pgf)"/>`;
    case 'sparkle': {
      const spots: Array<[number, number, number]> = [[0.16, 0.18, 1], [0.8, 0.14, 0.8], [0.12, 0.7, 0.9], [0.86, 0.62, 1], [0.3, 0.92, 0.7], [0.7, 0.9, 0.8], [0.5, 0.06, 0.6], [0.9, 0.38, 0.6], [0.08, 0.44, 0.6]];
      return spots.map(([u, v, k], i) => i % 3 === 2
        ? `<circle cx="${r2(b.x + u * b.w)}" cy="${r2(b.y + v * b.h)}" r="${r2(b.w * 0.022 * k)}" fill="#ffffff" opacity="0.9"/>`
        : sparkle(b.x + u * b.w, b.y + v * b.h, b.w * 0.06 * k, i % 2 ? '#ffffff' : fill)).join('');
    }
  }
}

// ── Backdrops (AN addendum) ─────────────────────────────────────────────────

/** A backdrop by id ('auto' / unknown → null: the light tint of the body color). */
export function avatarBackdrop(id: string | null | undefined): (typeof AVATAR_BACKDROPS)[number] | null {
  return AVATAR_BACKDROPS.find((b) => b.id === id) ?? null;
}

/** True when the backdrop is dark (the stage-edge line and ground shadow lighten on it). */
export function isDarkBackdrop(id: string | null | undefined): boolean {
  const b = avatarBackdrop(id);
  if (!b) return false;
  const n = parseInt(b.colors[0].slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum < 110;
}

/** The tile background (inside the frame band): defs + the stage rect and its motif. */
function backdropSvg(bg: string, pal: AvatarPalette, fw: number, rx: number): { defs: string[]; body: string } {
  const x0 = fw, size = 100 - 2 * fw;
  const rect = (fill: string) => `<rect x="${x0}" y="${x0}" width="${size}" height="${size}" rx="${rx}" fill="${fill}"/>`;
  const b = avatarBackdrop(bg);
  if (!b) {
    return {
      defs: [`<radialGradient id="${ID}-st" cx="0.5" cy="0.36" r="0.75"><stop offset="0" stop-color="${pal.stageIn}"/><stop offset="1" stop-color="${pal.stageOut}"/></radialGradient>`],
      body: rect(`url(#${ID}-st)`),
    };
  }
  const [c0, ...rest] = b.colors;
  if (b.kind === 'solid') {
    return {
      defs: [`<radialGradient id="${ID}-st" cx="0.5" cy="0.34" r="0.8"><stop offset="0" stop-color="${lightenHex(c0, 0.22)}"/><stop offset="1" stop-color="${c0}"/></radialGradient>`],
      body: rect(`url(#${ID}-st)`),
    };
  }
  if (b.kind === 'gradient') {
    const stops = b.colors.map((c, i) => `<stop offset="${r2(i / Math.max(1, b.colors.length - 1))}" stop-color="${c}"/>`).join('');
    return { defs: [`<linearGradient id="${ID}-st" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`], body: rect(`url(#${ID}-st)`) };
  }
  // Pattern: colors[0] base + the colors[1..] motif, clipped to the stage.
  const m = rest[0] ?? '#ffffff';
  let motif = '';
  switch (b.id) {
    case 'galaxy': {
      const spots: Array<[number, number, number]> = [[18, 20, 3.4], [78, 16, 2.6], [64, 40, 2], [12, 58, 2.4], [88, 66, 3], [30, 84, 2.2], [72, 88, 2.6], [46, 12, 1.8]];
      motif = `<circle cx="50" cy="44" r="38" fill="${lightenHex(c0, 0.22)}" opacity="0.55"/>`
        + spots.map(([x, y, r], i) => (i % 2 ? `<circle cx="${x}" cy="${y}" r="${r2(r * 0.45)}" fill="#ffffff" opacity="0.85"/>` : sparkle(x, y, r, m))).join('');
      break;
    }
    case 'polka':
      for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) {
        motif += `<circle cx="${r2(4 + col * 16 + (row % 2 ? 8 : 0))}" cy="${r2(4 + row * 16)}" r="3.4" fill="${m}"/>`;
      }
      break;
    case 'starry': {
      const spots: Array<[number, number, number]> = [[16, 18, 3.2], [82, 22, 2.6], [50, 10, 2.2], [12, 62, 2.4], [88, 58, 3], [24, 88, 2.4], [76, 86, 2.8], [60, 30, 1.6], [36, 36, 1.6]];
      motif = spots.map(([x, y, r]) => star(x, y, r, r * 0.45, m)).join('');
      break;
    }
    case 'sunburst':
      for (let i = 0; i < 12; i++) {
        if (i % 2) continue;
        const a0 = (i * Math.PI) / 6, a1 = ((i + 1) * Math.PI) / 6;
        motif += `<path d="M50,56 L${r2(50 + 90 * Math.cos(a0))},${r2(56 + 90 * Math.sin(a0))} L${r2(50 + 90 * Math.cos(a1))},${r2(56 + 90 * Math.sin(a1))} Z" fill="${m}" opacity="0.55"/>`;
      }
      break;
    case 'checkers':
      for (let row = 0; row < 8; row++) for (let col = 0; col < 8; col++) {
        if ((row + col) % 2) motif += `<rect x="${col * 12.5}" y="${row * 12.5}" width="12.5" height="12.5" fill="${m}"/>`;
      }
      break;
    case 'confetti': {
      const bits: Array<[number, number, number]> = [[14, 16, 20], [36, 10, -30], [70, 14, 45], [88, 30, -15], [10, 44, 60], [86, 52, 25], [20, 76, -40], [48, 90, 15], [80, 84, -60], [62, 28, 70], [30, 30, -10]];
      motif = bits.map(([x, y, rot], i) => `<rect x="${x - 2.4}" y="${y - 1.1}" width="4.8" height="2.2" rx="0.8" transform="rotate(${rot} ${x} ${y})" fill="${rest[i % rest.length] ?? m}"/>`).join('');
      break;
    }
  }
  return {
    defs: [`<clipPath id="${ID}-stc"><rect x="${x0}" y="${x0}" width="${size}" height="${size}" rx="${rx}"/></clipPath>`],
    body: `${rect(c0)}<g clip-path="url(#${ID}-stc)">${motif}</g>`,
  };
}

// ── The whole SVG ───────────────────────────────────────────────────────────

export interface MascotSvgInput {
  config: AvatarConfig;
  /** The body letter (one character; see avatarInitial). */
  initial: string;
  /** Rendered px size (picks the small / full layer set). */
  size: number;
  /** The frame actually worn (effectiveAvatarFrame); defaults to config.frame. */
  frame?: AvatarFrame;
  /** Art names (art-av-*) that have loaded: those parts are drawn from art. */
  art?: ReadonlySet<string>;
  /** /art/art-badge-pro-crown-sprite.webp (the crown hat). */
  crownSrc: string;
  /** artSrc from lib/art (name → public path). */
  artSrc: (name: string) => string;
}

/** The mascot SVG markup (ids use MASCOT_ID_TOKEN). Pure: same input → same string. */
export function mascotSvg(input: MascotSvgInput): string {
  const { config, size, art, crownSrc, artSrc } = input;
  const frame = input.frame ?? config.frame;
  const layers = new Set(avatarLayers(config, size, frame));
  const g = avatarGeometry(config, { small: isSmallAvatar(size) });
  const pal = avatarPalette(config);
  const b = g.box;
  const has = (name: string) => !!art && art.has(name);
  const bodyArt = has(avatarArtName('body', config.body));
  const path = bodyPath(config.body);
  const R = 100 * AVATAR_RADIUS;
  const fw = frame === 'none' ? 0 : FRAME_WIDTH;
  const metal = frame === 'none' ? null : AVATAR_FRAME_COLOR[frame];
  // The art body's box: the body plus room for its arms and feet.
  const artBox = { x: b.x - b.w * 0.14, y: b.y - b.h * 0.04, w: b.w * 1.28, h: b.h * 1.14 };

  const defs: string[] = [
    `<clipPath id="${ID}-clip"><path d="${path}"/></clipPath>`,
    `<linearGradient id="${ID}-bg" x1="0" y1="${r2(b.y)}" x2="0" y2="${r2(b.y + b.h)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${pal.light}"/><stop offset="0.55" stop-color="${pal.base}"/><stop offset="1" stop-color="${pal.dark}"/></linearGradient>`,
    `<linearGradient id="${ID}-gl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.62"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
  ];
  const stageRx = r2(Math.max(4, R - fw * 0.6));
  const backdrop = backdropSvg(config.bg, pal, fw, stageRx);
  defs.push(...backdrop.defs);
  if (layers.has('pattern')) {
    defs.push(`<linearGradient id="${ID}-pg" x1="0" y1="${r2(b.y)}" x2="0" y2="${r2(b.y + b.h)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${lightenHex(pal.pattern, 0.25)}"/><stop offset="0.55" stop-color="${pal.pattern}"/><stop offset="1" stop-color="${darkenHex(pal.pattern, 0.14)}"/></linearGradient>`);
    defs.push(`<linearGradient id="${ID}-pgf" x1="0" y1="${r2(b.y)}" x2="0" y2="${r2(b.y + b.h)}" gradientUnits="userSpaceOnUse"><stop offset="0.15" stop-color="${pal.pattern}" stop-opacity="0"/><stop offset="1" stop-color="${pal.pattern}" stop-opacity="1"/></linearGradient>`);
  }
  if (layers.has('neckBack')) {
    defs.push(`<linearGradient id="${ID}-cape" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f43f5e"/><stop offset="1" stop-color="#9f1239"/></linearGradient>`);
  }
  if (metal) {
    defs.push(`<linearGradient id="${ID}-fr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${metal.shine}"/><stop offset="0.45" stop-color="${metal.ring}"/><stop offset="1" stop-color="${darkenHex(metal.ring, 0.22)}"/></linearGradient>`);
  }
  if (bodyArt) {
    // Tint the white body art by multiply (keeps its gloss + shading) and use its alpha as the pattern mask.
    defs.push(`<filter id="${ID}-tint" color-interpolation-filters="sRGB"><feFlood flood-color="${pal.base}" result="c"/><feComposite in="c" in2="SourceAlpha" operator="in" result="ca"/><feBlend in="ca" in2="SourceGraphic" mode="multiply"/></filter>`);
    defs.push(`<filter id="${ID}-alpha" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 1 0"/></filter>`);
    defs.push(`<mask id="${ID}-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100"><image href="${esc(artSrc(avatarArtName('body', config.body)))}" x="${r2(artBox.x)}" y="${r2(artBox.y)}" width="${r2(artBox.w)}" height="${r2(artBox.h)}" preserveAspectRatio="xMidYMax meet" filter="url(#${ID}-alpha)"/></mask>`);
  }

  const out: string[] = [];
  const img = (name: string, x: number, y: number, w: number, h: number, extra = '') =>
    `<image href="${esc(artSrc(name))}" x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" preserveAspectRatio="xMidYMid meet"${extra}/>`;

  // Frame back + the tinted stage.
  if (layers.has('frameBack')) out.push(`<rect x="0" y="0" width="100" height="100" rx="${R}" fill="url(#${ID}-fr)"/>`);
  out.push(backdrop.body);
  // Ground shadow.
  out.push(`<ellipse cx="${r2(b.x + b.w / 2)}" cy="${r2(b.y + b.h + 4.2)}" rx="${r2(b.w * 0.42)}" ry="2.6" fill="${hexAlpha('#2a1745', 0.16)}"/>`);

  // Cape (behind).
  if (layers.has('neckBack')) {
    const backArt = avatarArtName('acc', config.neck);
    out.push(has(backArt) ? img(backArt, g.neck.x - g.neck.w * 0.9, g.neck.y - g.neck.w * 0.6, g.neck.w * 1.8, g.neck.w * 1.8) : drawNeckBack(config.neck, g));
  }

  // Body.
  if (bodyArt) {
    out.push(`<image href="${esc(artSrc(avatarArtName('body', config.body)))}" x="${r2(artBox.x)}" y="${r2(artBox.y)}" width="${r2(artBox.w)}" height="${r2(artBox.h)}" preserveAspectRatio="xMidYMax meet" filter="url(#${ID}-tint)"/>`);
  } else {
    // Stubby arms + feet (behind), the darker lip, then the body in its shaded tint.
    if (config.body !== 'star') {
      const ay = b.y + b.h * 0.6;
      const ax = Math.max(4, b.w * 0.075), ayr = Math.max(6, b.h * 0.115);
      out.push(`<ellipse cx="${r2(b.x + 1)}" cy="${r2(ay)}" rx="${r2(ax)}" ry="${r2(ayr)}" transform="rotate(28 ${r2(b.x + 1)} ${r2(ay)})" fill="${pal.dark}"/>`);
      out.push(`<ellipse cx="${r2(b.x + b.w - 1)}" cy="${r2(ay)}" rx="${r2(ax)}" ry="${r2(ayr)}" transform="rotate(-28 ${r2(b.x + b.w - 1)} ${r2(ay)})" fill="${pal.dark}"/>`);
    }
    for (const fx of [0.3, 0.7]) {
      out.push(`<ellipse cx="${r2(b.x + b.w * fx)}" cy="${r2(b.y + b.h + 0.6)}" rx="${r2(b.w * 0.13)}" ry="${r2(b.w * 0.075)}" fill="${pal.edge}"/>`);
    }
    out.push(`<path d="${path}" transform="translate(0 ${r2(b.h * 0.035)})" fill="${pal.edge}"/>`);
    out.push(`<path d="${path}" fill="url(#${ID}-bg)"/>`);
  }

  // Pattern, clipped to the body (the art's alpha when the art is in).
  if (layers.has('pattern')) {
    const clip = bodyArt ? `mask="url(#${ID}-mask)"` : `clip-path="url(#${ID}-clip)"`;
    out.push(`<g ${clip}${bodyArt ? ' style="mix-blend-mode:multiply"' : ''}>${drawPattern(config, g)}</g>`);
  }

  // Gloss (code body only: the art carries its own).
  if (!bodyArt) {
    out.push(`<g clip-path="url(#${ID}-clip)"><ellipse cx="${r2(b.x + b.w * 0.38)}" cy="${r2(b.y + b.h * 0.16)}" rx="${r2(b.w * 0.3)}" ry="${r2(b.h * 0.13)}" transform="rotate(-10 ${r2(b.x + b.w * 0.38)} ${r2(b.y + b.h * 0.16)})" fill="url(#${ID}-gl)"/><circle cx="${r2(b.x + b.w * 0.2)}" cy="${r2(b.y + b.h * 0.17)}" r="${r2(b.w * 0.035)}" fill="#ffffff" opacity="0.7"/></g>`);
  }

  // The body letter: the player's initial, white, embossed.
  const L = g.letter;
  const ch = esc(Array.from(input.initial || '?')[0] ?? '?');
  const text = (fill: string, dy: number, extra = '') =>
    `<text x="${r2(L.x)}" y="${r2(L.baseline + dy)}" text-anchor="middle" font-family="inherit" font-weight="900" font-size="${r2(L.fontSize)}" fill="${fill}"${extra}>${ch}</text>`;
  out.push(text(pal.edge, L.fontSize * 0.07, ' opacity="0.55"'));
  out.push(text('#ffffff', 0, ` stroke="${hexAlpha('#ffffff', 0.35)}" stroke-width="${r2(L.fontSize * 0.02)}"`));

  // Cheeks / nose → eyes → mouth.
  if (layers.has('nose')) {
    const n = avatarArtName('nose', config.nose);
    out.push(has(n) ? img(n, g.nose.x - g.nose.w / 2, g.nose.y - g.nose.w / 4, g.nose.w, g.nose.w / 2) : drawNose(config.nose, g.nose, g.eyes, pal));
  }
  {
    const n = avatarArtName('eyes', config.eyes);
    out.push(has(n) ? img(n, g.eyes.x - g.eyes.w / 2, g.eyes.y - g.eyes.w / 4, g.eyes.w, g.eyes.w / 2) : drawEyes(config.eyes, g.eyes));
  }
  {
    const n = avatarArtName('mouth', config.mouth);
    out.push(has(n) ? img(n, g.mouth.x - g.mouth.w / 2, g.mouth.y - g.mouth.w / 2, g.mouth.w, g.mouth.w) : drawMouth(config.mouth, g.mouth));
  }

  // Bow tie / flower, face accessory, hat.
  if (layers.has('neckFront')) {
    const n = avatarArtName('acc', config.neck);
    out.push(has(n) ? img(n, g.neck.x - g.neck.w / 2, g.letter.box.y - g.neck.w / 2, g.neck.w, g.neck.w) : drawNeckFront(config.neck, g, pal));
  }
  if (layers.has('face')) {
    const n = avatarArtName('acc', config.face);
    out.push(has(n) ? img(n, g.face.x - g.face.w / 2, g.face.y - g.face.w / 2, g.face.w, g.face.w) : drawFace(config.face, g));
  }
  if (layers.has('head')) {
    const n = avatarArtName('acc', config.head);
    out.push(has(n) ? img(n, g.head.x - g.head.w / 2, g.head.y - g.head.w, g.head.w, g.head.w) : drawHead(config.head, g, crownSrc, pal));
  }

  // Front frame: the inner shine at the stage edge (+ diamond glints).
  if (layers.has('frameFront') && metal) {
    out.push(`<rect x="${r2(fw - 0.6)}" y="${r2(fw - 0.6)}" width="${r2(100 - 2 * fw + 1.2)}" height="${r2(100 - 2 * fw + 1.2)}" rx="${r2(Math.max(4, R - fw * 0.6))}" fill="none" stroke="${metal.shine}" stroke-width="1.2" opacity="0.9"/>`);
    out.push(`<rect x="0.7" y="0.7" width="98.6" height="98.6" rx="${R}" fill="none" stroke="${darkenHex(metal.ring, 0.3)}" stroke-width="1.1" opacity="0.55"/>`);
    if (frame === 'diamond') out.push(sparkle(9, 9, 4, '#ffffff') + sparkle(91, 91, 3.4, '#ffffff'));
  }

  return `<svg viewBox="0 0 100 100" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false" style="display:block"><defs>${defs.join('')}</defs>${out.join('')}</svg>`;
}

/** A stable key for a config (every field, in schema order). */
export function avatarConfigKey(c: AvatarConfig): string {
  return [c.body, c.color, c.pattern, c.patternColor, c.eyes, c.nose, c.mouth, c.head, c.face, c.neck, c.frame, c.bg, c.display].join('.');
}

const svgCache = new Map<string, string>();
const SVG_CACHE_MAX = 400;

/** mascotSvg, memoized per config + initial + frame + size class + loaded art (shared by every avatar on the page). */
export function cachedMascotSvg(input: MascotSvgInput): string {
  const frame = input.frame ?? input.config.frame;
  const artKey = input.art && input.art.size ? avatarArtNames(input.config).filter((n) => input.art!.has(n)).join(',') : '';
  const key = `${avatarConfigKey(input.config)}|${input.initial}|${frame}|${isSmallAvatar(input.size) ? 's' : 'l'}|${artKey}`;
  const hit = svgCache.get(key);
  if (hit) return hit;
  const svg = mascotSvg(input);
  if (svgCache.size >= SVG_CACHE_MAX) {
    const first = svgCache.keys().next().value;
    if (first !== undefined) svgCache.delete(first);
  }
  svgCache.set(key, svg);
  return svg;
}

/** The markup with its id placeholder swapped for `id` (unique per rendered avatar). */
export function withAvatarId(svg: string, id: string): string {
  return svg.split(MASCOT_ID_TOKEN).join(id);
}

// ── The builder's options (AN4) ─────────────────────────────────────────────

/** The builder's category tabs, in order. */
export const BUILDER_TABS = [
  { id: 'body', label: 'Body' },
  { id: 'color', label: 'Color' },
  { id: 'pattern', label: 'Pattern' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'nose', label: 'Nose' },
  { id: 'mouth', label: 'Mouth' },
  { id: 'head', label: 'Hats' },
  { id: 'extras', label: 'Extras' },
  { id: 'bg', label: 'Backdrop' },
  { id: 'frame', label: 'Frame' },
] as const;
export type BuilderTab = (typeof BUILDER_TABS)[number]['id'];

/** The config fields the builder's option tiles set. */
export type BuilderField = 'body' | 'color' | 'pattern' | 'patternColor' | 'eyes' | 'nose' | 'mouth' | 'head' | 'face' | 'neck' | 'bg' | 'frame';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const LABELS: Partial<Record<BuilderField, Record<string, string>>> = {
  pattern: { solid: 'Solid', twotone: 'Two-tone', stripes: 'Stripes', dots: 'Polka dots', gradient: 'Gradient', sparkle: 'Sparkle' },
  eyes: { beady: 'Beady eyes', happy: 'Happy eyes', sparkly: 'Sparkly eyes', sleepy: 'Sleepy eyes', wink: 'Wink', hearts: 'Heart eyes', stars: 'Star eyes', glasses: 'Round glasses', cyclops: 'One big eye' },
  nose: { none: 'No nose', button: 'Button nose', red: 'Round red nose', blush: 'Blush cheeks', freckles: 'Freckles' },
  mouth: { smile: 'Smile', grin: 'Big grin', tongue: 'Tongue out', o: 'Little o', cat: 'Cat smile', toothy: 'Toothy grin', smirk: 'Smirk', tiny: 'Tiny smile', gasp: 'Gasp' },
  head: {
    none: 'No hat', crown: 'Crown', party: 'Party hat', beanie: 'Beanie', sprout: 'Sprout', nightcap: 'Nightcap', headphones: 'Headphones',
    bow: 'Bow', wizard: 'Wizard hat', pirate: 'Pirate hat', cowboy: 'Cowboy hat', chef: 'Chef hat', grad: 'Graduation cap', halo: 'Halo',
    flower: 'Flower', tophat: 'Top hat', propeller: 'Propeller cap', catears: 'Cat ears', bunnyears: 'Bunny ears', tiara: 'Tiara',
    viking: 'Viking helmet', sweatband: 'Sweatband',
  },
  face: { none: 'Nothing on the face', mustache: 'Mustache', 'heart-glasses': 'Heart shades', monocle: 'Monocle' },
  neck: { none: 'Nothing on the neck', cape: 'Cape', wings: 'Wings', bowtie: 'Bow tie', scarf: 'Scarf', chain: 'Gold chain' },
  bg: { auto: 'Match my color', cottoncandy: 'Cotton candy' },
  frame: { none: 'No frame', pro: 'Pro gold' },
};

/** The screen-reader / tile label for an option ("Party hat", "Cotton candy"). */
export function avatarOptionLabel(field: BuilderField, id: string): string {
  const named = LABELS[field === 'patternColor' ? 'color' : field]?.[id];
  if (named) return named;
  const base = cap(id.replace(/-/g, ' '));
  if (field === 'body') return `${base} body`;
  if (field === 'frame') return `${base} frame`;
  return base;
}

/** The ids a field offers, in builder order. */
export function avatarOptionIds(field: BuilderField): readonly string[] {
  switch (field) {
    case 'body': return AVATAR_BODIES;
    case 'color': case 'patternColor': return AVATAR_COLORS.map((c) => c.id);
    case 'pattern': return AVATAR_PATTERNS;
    case 'eyes': return AVATAR_EYES;
    case 'nose': return AVATAR_NOSES;
    case 'mouth': return AVATAR_MOUTHS;
    case 'head': return AVATAR_HEADS;
    case 'face': return AVATAR_FACES;
    case 'neck': return AVATAR_NECKS;
    case 'bg': return AVATAR_BACKDROP_IDS;
    case 'frame': return AVATAR_FRAMES;
  }
}

/** Pro-only options (core AVATAR_PRO_ONLY): free players see the gold PRO pill → the Go Pro popup. */
export function avatarProOnly(field: BuilderField, id: string): boolean {
  const list = (AVATAR_PRO_ONLY as Record<string, readonly string[] | undefined>)[field];
  return !!list && list.includes(id);
}

/** The level a tier frame unlocks at (core levelTier thresholds); null for frames not earned by level. */
export const FRAME_UNLOCK_LEVEL: Partial<Record<AvatarFrame, number>> = { bronze: 1, silver: 11, gold: 26, platinum: 51 };

/** True when a tier frame is still locked at `level` (Pro-only frames are gated by Pro instead). */
export function frameLevelLocked(frame: AvatarFrame, level: number | null | undefined): boolean {
  const need = FRAME_UNLOCK_LEVEL[frame];
  return need != null && (Number(level) || 0) < need;
}

/**
 * Randomize (AN4): a playful new mascot. Keeps the frame (earned) and the
 * photo / mascot choice; never picks a Pro-only option for a free player.
 * `rng` returns [0, 1) (Math.random in the app; seeded in tests).
 */
export function randomAvatar(current: AvatarConfig, rng: () => number, { isPro }: { isPro: boolean }): AvatarConfig {
  const pick = <T extends string>(field: BuilderField, ids: readonly T[]): T => {
    const ok = ids.filter((id) => isPro || !avatarProOnly(field, id));
    return ok[Math.floor(rng() * ok.length) % ok.length];
  };
  const maybe = <T extends string>(field: BuilderField, ids: readonly T[], chanceNone: number): T =>
    (rng() < chanceNone ? ('none' as T) : pick(field, ids.filter((i) => i !== 'none')));
  const colors = AVATAR_COLORS.map((c) => c.id);
  const color = pick('color', colors);
  const patternColor = pick('patternColor', colors.filter((c) => c !== color));
  return {
    ...current,
    body: pick('body', AVATAR_BODIES),
    color,
    pattern: rng() < 0.5 ? 'solid' : pick('pattern', AVATAR_PATTERNS.filter((p) => p !== 'solid')),
    patternColor,
    eyes: pick('eyes', AVATAR_EYES),
    nose: maybe('nose', AVATAR_NOSES, 0.4),
    mouth: pick('mouth', AVATAR_MOUTHS),
    head: maybe('head', AVATAR_HEADS, 0.45),
    face: maybe('face', AVATAR_FACES, 0.75),
    neck: maybe('neck', AVATAR_NECKS, 0.7),
    bg: rng() < 0.4 ? 'auto' : pick('bg', AVATAR_BACKDROP_IDS.filter((b) => b !== 'auto')),
  };
}
