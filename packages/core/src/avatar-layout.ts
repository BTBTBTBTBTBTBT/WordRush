// The mascot FIT SYSTEM (founder 10-03: "when the user puts any combination of these together it will seem
// natural, not clipping or going off screen"). One pure layout every renderer draws from (web avatar-render,
// iOS MascotAvatar, Android MascotComposer), pinned across platforms by avatar-layout-fixtures.json.
//
//   1. Per-body anchors (avatar-parts.json `bodies`): face box, head line, neck, shoulders, back point,
//      cape line, hand. Every part is placed AND scaled from the chosen body's anchors.
//   2. Per-part metadata (`items`): width as a fraction of its slot's base width, canvas aspect, anchor point
//      inside the canvas, hat overlap, per-body overrides (`bodies.<id>.overrides["acc:<id>"]`).
//   3. Safe frame (`fit`): the union of every drawn layer is scaled uniformly to fit the tile with `pad` on
//      each side (never larger than `maxBody`), so a hat or wings shrink the whole avatar instead of spilling.
//   4. Layer order (`layerOrder`) + conflicts (`conflicts`): picking one side of a conflict swaps the other out.
//
// Coordinates: everything is computed in BODY UNITS (fractions of the body art square), then mapped to the
// avatar's CONTENT square (inside its frame band) as 0–1 fractions.

import partsJson from './avatar-parts.json';
import { AVATAR_TINTABLE, type AvatarConfig } from './avatar-config';

export interface AvatarRect { x: number; y: number; w: number; h: number }

export interface AvatarBodyAnchors {
  faceCenter: [number, number];
  eyeY: number; mouthY: number; cheekY: number;
  headTop: { x: number; y: number; w: number };
  neckY: number;
  letterBox: [number, number, number, number];
  face: { x: number; w: number };
  mustacheY: number;
  shoulderW: number;
  back: { x: number; y: number; w: number };
  cape: { y: number };
  hand: { x: number; y: number };
  bounds: [number, number, number, number];
  overrides?: Record<string, { dx?: number; dy?: number; scale?: number }>;
}

export interface AvatarItemMeta {
  w: number; aspect: number; anchor: [number, number]; slot: string; layer: string; overlap?: number; tint?: boolean;
  /** Hats only: may come down beside the eyes (headphones). Every other hat clears the eyes. */
  overFace?: boolean;
}

/** The gap a hat keeps above the eyes / glasses (body units). */
export const HAT_EYE_CLEARANCE = 0.012;

export interface AvatarConflict { a: string; aIds: string[]; b: string; bIds: string[] }

export interface AvatarManifest {
  version?: number;
  fit: { pad: number; maxBody: number; minBody: number };
  layerOrder: string[];
  bodies: Record<string, AvatarBodyAnchors>;
  items: Record<string, AvatarItemMeta>;
  conflicts: AvatarConflict[];
}

export const AVATAR_MANIFEST = partsJson as unknown as AvatarManifest;

/** The config fields that hold a part, and the art kind each one draws. */
export const AVATAR_PART_FIELDS = ['cheeks', 'eyes', 'nose', 'mouth', 'face', 'head', 'neck'] as const;
export type AvatarPartField = (typeof AVATAR_PART_FIELDS)[number];
const FIELD_KIND: Record<AvatarPartField, string> = { cheeks: 'cheeks', eyes: 'eyes', nose: 'nose', mouth: 'mouth', face: 'acc', head: 'acc', neck: 'acc' };

export interface AvatarLayoutLayer {
  /** back | body | cheeks | eyes | nose | mouth | face | head | neckFront */
  layer: string;
  /** The config field it comes from ('body' for the body). */
  field: string;
  id: string;
  /** art-av-<kind>-<id> */
  art: string;
  /** In content-square fractions (0–1). */
  rect: AvatarRect;
  /** White art that takes the accessory color. */
  tint: boolean;
}

export interface AvatarLayout {
  /** Body-square side as a fraction of the content square. */
  scale: number;
  /** The body art square (content fractions); patterns are clipped to the body art inside it. */
  body: AvatarRect;
  /** The white initial's box (content fractions). */
  letter: AvatarRect;
  /** Back → front, the body included (layer 'body'). */
  layers: AvatarLayoutLayer[];
  /** The union of everything drawn (content fractions) — always inside the padded frame. */
  bounds: AvatarRect;
}

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Sizes at or below this draw only the body, face and hat (AN5 legibility rule). */
export const AVATAR_LAYOUT_SMALL = 28;

/**
 * A pick that would collide with something already worn: the field + id it swaps out, else null.
 * (The maker applies the pick with `applyAvatarPick`, which clears that item.)
 */
export function avatarPickConflict(config: Pick<AvatarConfig, AvatarPartField>, field: string, id: string, manifest: AvatarManifest = AVATAR_MANIFEST): { field: string; id: string } | null {
  if (id === 'none') return null;
  for (const c of manifest.conflicts ?? []) {
    for (const [mine, mineIds, other, otherIds] of [[c.a, c.aIds, c.b, c.bIds], [c.b, c.bIds, c.a, c.aIds]] as const) {
      if (mine !== field || !(mineIds.includes(id) || mineIds.includes('*'))) continue;
      const worn = (config as Record<string, string>)[other];
      if (worn && worn !== 'none' && (otherIds.includes(worn) || otherIds.includes('*'))) return { field: other, id: worn };
    }
  }
  return null;
}

/** What a swapped-out field resets to (eyes and mouth always draw something). */
export const AVATAR_PICK_RESET: Readonly<Record<string, string>> = { eyes: 'beady', mouth: 'smile' };

/** Set field = id and swap out whatever it conflicts with (repeat until clean). */
export function applyAvatarPick<T extends AvatarConfig>(config: T, field: keyof T & string, id: string, manifest: AvatarManifest = AVATAR_MANIFEST): T {
  let next = { ...config, [field]: id } as T;
  for (let i = 0; i < 4; i++) {
    const hit = avatarPickConflict(next, field, id, manifest);
    if (!hit) break;
    next = { ...next, [hit.field]: AVATAR_PICK_RESET[hit.field] ?? 'none' } as T;
  }
  return next;
}

/** The parts a config actually draws, after conflicts (later fields in the priority list lose). */
function wornParts(config: AvatarConfig, small: boolean, manifest: AvatarManifest): Array<[AvatarPartField, string]> {
  const out: Array<[AvatarPartField, string]> = [];
  const priority: AvatarPartField[] = ['eyes', 'mouth', 'head', 'nose', 'cheeks', 'neck', 'face'];
  const kept: Record<string, string> = {};
  for (const f of priority) {
    const id = (config as unknown as Record<string, string>)[f];
    if (!id || id === 'none') continue;
    if (small && !['eyes', 'mouth', 'head', 'nose'].includes(f)) continue;
    const key = `${FIELD_KIND[f]}:${id}`;
    if (!manifest.items[key]) continue;
    const view = { ...kept } as Pick<AvatarConfig, AvatarPartField>;
    if (avatarPickConflict(view, f, id, manifest)) continue;
    kept[f] = id;
    out.push([f, id]);
  }
  return out;
}

function slotPoint(b: AvatarBodyAnchors, slot: string): { x: number; y: number; base: number } {
  switch (slot) {
    case 'eyes': case 'glasses': return { x: b.face.x, y: b.eyeY, base: b.face.w };
    case 'nose': return { x: b.face.x, y: b.cheekY, base: b.face.w };
    case 'cheeks': return { x: b.face.x, y: b.cheekY, base: b.face.w };
    case 'mouth': return { x: b.face.x, y: b.mouthY, base: b.face.w };
    case 'mustache': return { x: b.face.x, y: b.mustacheY, base: b.face.w };
    case 'head': return { x: b.headTop.x, y: b.headTop.y, base: b.headTop.w };
    case 'neck': return { x: b.face.x, y: b.neckY, base: b.shoulderW };
    case 'hand': return { x: b.hand.x, y: b.hand.y, base: b.back.w };
    case 'cape': return { x: b.back.x, y: b.cape.y, base: b.back.w };
    case 'back': default: return { x: b.back.x, y: b.back.y, base: b.back.w };
  }
}

/**
 * Where every layer of `config` goes. `small` (≤ 28 px) keeps only the body, eyes, mouth, nose and hat.
 * Pure; every renderer draws exactly these rects.
 */
export function avatarLayout(config: AvatarConfig, { small = false }: { small?: boolean } = {}, manifest: AvatarManifest = AVATAR_MANIFEST): AvatarLayout {
  const b = manifest.bodies[config.body] ?? manifest.bodies.classic;
  const placed: Array<{ layer: string; field: string; id: string; art: string; rect: AvatarRect; tint: boolean }> = [];
  for (const [field, id] of wornParts(config, small, manifest)) {
    const key = `${FIELD_KIND[field]}:${id}`;
    const m = manifest.items[key];
    const p = slotPoint(b, m.slot);
    const o = b.overrides?.[key] ?? {};
    const w = p.base * m.w * (o.scale ?? 1);
    const h = w * m.aspect;
    placed.push({
      layer: m.layer, field, id, art: `art-av-${FIELD_KIND[field]}-${id}`,
      rect: { x: p.x - m.anchor[0] * w + (o.dx ?? 0), y: p.y - m.anchor[1] * h + (o.dy ?? 0), w, h },
      tint: !!m.tint && AVATAR_TINTABLE.includes(id),
    });
  }
  // Hats clear the face: a hat whose bottom would cover the eyes / glasses moves up (overFace hats excepted).
  const faceTop = Math.min(...placed.filter((p) => p.layer === 'eyes' || (p.layer === 'face' && manifest.items[`acc:${p.id}`]?.slot === 'glasses')).map((p) => p.rect.y), Infinity);
  for (const p of placed) {
    if (p.layer !== 'head' || manifest.items[`acc:${p.id}`]?.overFace || !Number.isFinite(faceTop)) continue;
    const limit = faceTop - HAT_EYE_CLEARANCE;
    const bottom = p.rect.y + p.rect.h;
    if (bottom > limit) p.rect = { ...p.rect, y: p.rect.y - (bottom - limit) };
  }
  // the union of the body art's content + every part
  let x0 = b.bounds[0], y0 = b.bounds[1], x1 = b.bounds[2], y1 = b.bounds[3];
  for (const p of placed) {
    x0 = Math.min(x0, p.rect.x); y0 = Math.min(y0, p.rect.y);
    x1 = Math.max(x1, p.rect.x + p.rect.w); y1 = Math.max(y1, p.rect.y + p.rect.h);
  }
  const { pad, maxBody } = manifest.fit;
  const avail = 1 - 2 * pad;
  const s = Math.min(maxBody, avail / (x1 - x0), avail / (y1 - y0));
  const tx = 0.5 - ((x0 + x1) / 2) * s;
  const ty = 0.5 - ((y0 + y1) / 2) * s;
  const map = (r: AvatarRect): AvatarRect => ({ x: r4(tx + r.x * s), y: r4(ty + r.y * s), w: r4(r.w * s), h: r4(r.h * s) });
  const order = manifest.layerOrder;
  const bodyLayer = { layer: 'body', field: 'body', id: config.body, art: `art-av-body-${config.body}`, rect: map({ x: 0, y: 0, w: 1, h: 1 }), tint: false };
  const layers = [bodyLayer, ...placed.map((p) => ({ ...p, rect: map(p.rect) }))]
    .sort((a, c) => order.indexOf(a.layer) - order.indexOf(c.layer));
  const [lx, ly, lw, lh] = b.letterBox;
  return {
    scale: r4(s),
    body: bodyLayer.rect,
    letter: map({ x: lx, y: ly, w: lw, h: lh }),
    layers,
    bounds: map({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }),
  };
}

// ── Patterns (code-drawn, shared) ────────────────────────────────────────────

/**
 * A pattern as primitives in BODY-SQUARE units (0–1), drawn over the body color, clipped to the body art
 * and multiplied onto it. Colors: 'ink' = the pattern color, 'base' = the body color, 'light' = white.
 */
export type AvatarPatternShape =
  | { t: 'rect'; x: number; y: number; w: number; h: number; c: string; a?: number }
  | { t: 'circle'; x: number; y: number; r: number; c: string; a?: number }
  | { t: 'star'; x: number; y: number; r: number; inner: number; n: number; c: string; a?: number }
  | { t: 'heart'; x: number; y: number; s: number; c: string; a?: number }
  | { t: 'poly'; pts: Array<[number, number]>; c: string; a?: number }
  | { t: 'grad'; x1: number; y1: number; x2: number; y2: number; stops: Array<[number, string, number]> };

/** The pattern's shapes (empty for solid). Deterministic; pinned by the layout fixture. */
export function avatarPatternShapes(pattern: string): AvatarPatternShape[] {
  const out: AvatarPatternShape[] = [];
  const grid = (step: number, f: (x: number, y: number, row: number) => void) => {
    let row = 0;
    for (let y = step / 2; y < 1.05; y += step, row++) for (let x = (row % 2 ? step : step / 2); x < 1.05; x += step) f(r4(x), r4(y), row);
  };
  switch (pattern) {
    case 'twotone': out.push({ t: 'rect', x: 0, y: 0.56, w: 1, h: 0.44, c: 'ink' }); break;
    case 'stripes': for (let y = 0.1; y < 1; y += 0.15) out.push({ t: 'rect', x: 0, y: r4(y), w: 1, h: 0.065, c: 'ink' }); break;
    case 'dots': grid(0.17, (x, y) => out.push({ t: 'circle', x, y, r: 0.045, c: 'ink' })); break;
    case 'gradient': out.push({ t: 'grad', x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.92, stops: [[0, 'ink', 0], [1, 'ink', 1]] }); break;
    case 'sparkle':
      for (const [x, y, r] of [[0.22, 0.22, 0.05], [0.72, 0.18, 0.04], [0.84, 0.46, 0.05], [0.16, 0.56, 0.04], [0.5, 0.3, 0.03], [0.32, 0.8, 0.05], [0.7, 0.74, 0.04], [0.58, 0.9, 0.03]])
        out.push({ t: 'star', x, y, r, inner: r4(r * 0.35), n: 4, c: 'ink' });
      break;
    case 'hearts': grid(0.2, (x, y) => out.push({ t: 'heart', x, y, s: 0.075, c: 'ink' })); break;
    case 'stars': grid(0.2, (x, y) => out.push({ t: 'star', x, y, r: 0.055, inner: 0.024, n: 5, c: 'ink' })); break;
    case 'zigzag':
      for (let y = 0.12; y < 1.05; y += 0.2) {
        const pts: Array<[number, number]> = [];
        for (let i = 0; i <= 10; i++) pts.push([r4(i / 10), r4(y + (i % 2 ? -0.045 : 0.045))]);
        for (let i = 10; i >= 0; i--) pts.push([r4(i / 10), r4(y + 0.06 + (i % 2 ? -0.045 : 0.045))]);
        out.push({ t: 'poly', pts, c: 'ink' });
      }
      break;
    case 'checkers':
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 0) out.push({ t: 'rect', x: r4(c / 8), y: r4(r / 8), w: 0.125, h: 0.125, c: 'ink' });
      break;
    case 'tiedye':
      for (let i = 7; i >= 1; i--) out.push({ t: 'circle', x: 0.42, y: 0.46, r: r4(i * 0.11), c: i % 2 ? 'ink' : 'light', a: i % 2 ? 0.85 : 0.5 });
      break;
    case 'leopard':
      grid(0.22, (x, y, row) => {
        const dx = row % 2 ? 0.02 : -0.02;
        out.push({ t: 'circle', x: r4(x + dx), y, r: 0.055, c: 'ink' });
        out.push({ t: 'circle', x: r4(x + dx + 0.012), y: r4(y - 0.008), r: 0.03, c: 'base' });
      });
      break;
    case 'galaxy':
      out.push({ t: 'grad', x1: 0, y1: 0, x2: 1, y2: 1, stops: [[0, 'ink', 0.95], [1, 'ink', 0.55]] });
      for (const [x, y, r] of [[0.18, 0.2, 0.012], [0.7, 0.14, 0.016], [0.42, 0.34, 0.01], [0.86, 0.38, 0.012], [0.25, 0.55, 0.014], [0.6, 0.6, 0.01], [0.8, 0.78, 0.014], [0.35, 0.85, 0.012], [0.12, 0.74, 0.01]])
        out.push({ t: 'circle', x, y, r, c: 'light' });
      for (const [x, y] of [[0.55, 0.24], [0.2, 0.4], [0.72, 0.5], [0.5, 0.82]]) out.push({ t: 'star', x, y, r: 0.04, inner: 0.012, n: 4, c: 'light' });
      break;
    case 'colorblock': out.push({ t: 'rect', x: 0.5, y: 0, w: 0.5, h: 1, c: 'ink' }); break;
    default: break;
  }
  return out;
}
