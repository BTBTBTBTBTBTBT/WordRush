import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

// 2.7.1 regression (c08582d9): neck items (chain, capes, vampire collar, scarf, bandana, lei) drew a
// straight band at the wrap line, edge to edge over both arms — "went around his arms like a hula
// hoop". The face / letter fit checks passed them. This is the TS port of the design tool's hoop
// check (docs/design/brand/avatar/integration/audit.py --wraps) over the art the web actually ships:
// every wrap-line layer (manifest pieces `wrap`, plus per-body neckFront / wrap art) is drawn at its
// manifest rect on its body, and fails when its opaque pixels
//   - sit on the body's arms (the manifest's hand ellipses, inside the silhouette) beyond ARM_MAX, or
//   - form a hoop: on a row at arm height they cover >= HOOP_SPAN of the body's width.
// HOOP_ART_DIR / HOOP_MANIFEST check another copy (e.g. a `git archive` of an older commit).
const ROOT = join(__dirname, '..', '..', '..');
const ART = process.env.HOOP_ART_DIR ?? join(ROOT, 'apps/web/public/art');
const MANIFEST = process.env.HOOP_MANIFEST ?? join(ROOT, 'packages/core/src/avatar-parts.json');

const U = 320; // body square px (audit.py uses 640; the thresholds scale with it)
const M = U / 2; // margin around the body square (pieces may start left of / above it)
const CW = U + 2 * M;
const ARM_MAX = 0.0006; // of the body square's area: an anti-aliased edge, never a band
const HOOP_SPAN = 0.7;
const WAIST = new Set(['acc:apron', 'acc:belt']); // waist garments DO go around the body, under the hands

type Rect = [number, number, number, number];
interface Manifest {
  bodies: Record<string, { hands?: Record<'L' | 'R', [number, number, number, number]> }>;
  items: Record<string, { layer?: string; pieces?: Record<string, Array<[string, ...Rect]>>; perBody?: Record<string, Rect> }>;
}

/** The art's alpha (> 128) resized to w × h px. */
async function alpha(file: string, w: number, h: number): Promise<Uint8Array> {
  const { data } = await sharp(file).ensureAlpha().resize(w, h, { fit: 'fill' }).extractChannel('alpha').raw().toBuffer({ resolveWithObject: true });
  return Uint8Array.from(data, (v) => (v > 128 ? 1 : 0));
}

/** Every shipped wrap-line layer: item key → body → [art file, rect]. */
function wrapLayers(man: Manifest): Map<string, Map<string, Array<[string, Rect]>>> {
  const out = new Map<string, Map<string, Array<[string, Rect]>>>();
  const add = (key: string, body: string, file: string, r: Rect) => {
    if (!out.has(key)) out.set(key, new Map());
    const m = out.get(key)!;
    if (!m.has(body)) m.set(body, []);
    m.get(body)!.push([file, r]);
  };
  for (const [key, it] of Object.entries(man.items)) {
    const [kind, id] = key.split(':');
    for (const [body, rows] of Object.entries(it.pieces ?? {})) {
      for (const [layer, ...r] of rows) if (layer === 'wrap') add(key, body, `art-av-${kind}-${id}-${body}-${layer}.webp`, r as Rect);
    }
    if (it.layer === 'neckFront' || it.layer === 'wrap') {
      for (const [body, r] of Object.entries(it.perBody ?? {})) add(key, body, `art-av-${kind}-${id}-${body}.webp`, r);
    }
  }
  return out;
}

async function wrapHoops(man: Manifest): Promise<{ checked: number; fails: string[] }> {
  const fails: string[] = [];
  let checked = 0;
  const bodies = new Map<string, { A: Uint8Array; arms: Uint8Array; armRows: number[] }>();
  const bodyMasks = async (body: string) => {
    if (bodies.has(body)) return bodies.get(body)!;
    const a = await alpha(join(ART, `art-av-body-${body}.webp`), U, U);
    const A = new Uint8Array(CW * CW);
    for (let y = 0; y < U; y++) for (let x = 0; x < U; x++) A[(y + M) * CW + x + M] = a[y * U + x];
    const arms = new Uint8Array(CW * CW);
    const armRows = new Set<number>();
    for (const [cx, cy, rx, ry] of Object.values(man.bodies[body].hands ?? {})) {
      for (let y = 0; y < CW; y++) {
        for (let x = 0; x < CW; x++) {
          const i = y * CW + x;
          if (A[i] && ((x - (M + cx * U)) / (rx * U)) ** 2 + ((y - (M + cy * U)) / (ry * U)) ** 2 <= 1) {
            arms[i] = 1;
            armRows.add(y);
          }
        }
      }
    }
    const v = { A, arms, armRows: [...armRows].sort((p, q) => p - q) };
    bodies.set(body, v);
    return v;
  };

  for (const [key, perBody] of wrapLayers(man)) {
    for (const [body, layers] of perBody) {
      if (!man.bodies[body]?.hands) continue;
      const { A, arms, armRows } = await bodyMasks(body);
      const m = new Uint8Array(CW * CW);
      for (const [file, [x, y, w, h]] of layers) {
        const pw = Math.max(1, Math.round(w * U)), ph = Math.max(1, Math.round(h * U));
        const a = await alpha(join(ART, file), pw, ph);
        const X = Math.round(M + x * U), Y = Math.round(M + y * U);
        for (let j = 0; j < ph; j++) {
          for (let i = 0; i < pw; i++) {
            const cx = X + i, cy = Y + j;
            if (a[j * pw + i] && cx >= 0 && cy >= 0 && cx < CW && cy < CW) m[cy * CW + cx] = 1;
          }
        }
      }
      checked++;
      if (WAIST.has(key)) continue;
      let onArm = 0;
      for (let i = 0; i < m.length; i++) onArm += m[i] & arms[i];
      if (onArm > ARM_MAX * U * U) {
        fails.push(`${key} on ${body}: over the arms (${onArm} px)`);
        continue;
      }
      for (const yy of armRows) {
        let row = 0, covered = 0;
        for (let x = 0; x < CW; x++) {
          const i = yy * CW + x;
          row += A[i];
          covered += A[i] & m[i];
        }
        if (row && covered >= HOOP_SPAN * row) {
          fails.push(`${key} on ${body}: a straight band across the body at arm height (y=${((yy - M) / U).toFixed(3)})`);
          break;
        }
      }
    }
  }
  return { checked, fails };
}

describe('mascot neck / wrap-line items hang as a drape, never a hoop over the arms', () => {
  it('ships every wrap-line layer the manifest names', () => {
    const man = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
    const missing: string[] = [];
    for (const perBody of wrapLayers(man).values()) for (const layers of perBody.values()) for (const [f] of layers) if (!existsSync(join(ART, f))) missing.push(f);
    expect(missing).toEqual([]);
  });

  it('keeps every shipped wrap-line layer off the arms and out of a straight band', async () => {
    const man = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Manifest;
    const { checked, fails } = await wrapHoops(man);
    // The 7 neck items alone are 82 body layers; the whole check covers more.
    expect(checked).toBeGreaterThanOrEqual(82);
    expect(fails).toEqual([]);
  }, 120_000);
});
