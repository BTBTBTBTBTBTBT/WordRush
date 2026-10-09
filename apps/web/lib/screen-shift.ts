// Screen-shift math (pure) for the scripted play harness (e2e/screen-shift.test.ts, docs/FRIDAY-QUEUE item 37).
// Founder 10-08: "no screen shifting anywhere like Codebreaker" — nothing resizes or moves during play except
// the piece being played. The harness records the bounding box of each named region (board, keyboard, header,
// control bar, chip strip …) before and after every scripted action; any move or resize beyond the tolerance
// (1 px) that isn't an allowed region is a failure.

export interface Box { x: number; y: number; width: number; height: number }
export type Boxes = Record<string, Box | null>;

export interface Shift {
  region: string;
  /** 'moved' / 'resized' (both reported when both happen), 'appeared' / 'vanished' for a region that came or went. */
  kind: 'moved' | 'resized' | 'appeared' | 'vanished';
  dx: number;
  dy: number;
  dw: number;
  dh: number;
}

/** The pixel tolerance: sub-pixel layout rounding is not a shift. */
export const SHIFT_TOLERANCE_PX = 1;

/**
 * Every region whose box changed by more than `tolerance` between `before` and `after`. `allowed` names regions that
 * may change in this step (the piece being played, e.g. the board when a row is added).
 */
export function diffBoxes(before: Boxes, after: Boxes, opts: { tolerance?: number; allowed?: string[] } = {}): Shift[] {
  const tol = opts.tolerance ?? SHIFT_TOLERANCE_PX;
  const allowed = new Set(opts.allowed ?? []);
  const out: Shift[] = [];
  for (const region of Object.keys(before)) {
    if (allowed.has(region)) continue;
    const a = before[region];
    const b = after[region] ?? null;
    if (!a && !b) continue;
    if (!a && b) { out.push({ region, kind: 'appeared', dx: 0, dy: 0, dw: 0, dh: 0 }); continue; }
    if (a && !b) { out.push({ region, kind: 'vanished', dx: 0, dy: 0, dw: 0, dh: 0 }); continue; }
    const dx = round(b!.x - a!.x), dy = round(b!.y - a!.y), dw = round(b!.width - a!.width), dh = round(b!.height - a!.height);
    if (Math.abs(dx) > tol || Math.abs(dy) > tol) out.push({ region, kind: 'moved', dx, dy, dw, dh });
    if (Math.abs(dw) > tol || Math.abs(dh) > tol) out.push({ region, kind: 'resized', dx, dy, dw, dh });
  }
  return out;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

/** One line per shift, for the failure message. */
export function describeShift(scenario: string, step: string, s: Shift): string {
  const d = s.kind === 'appeared' || s.kind === 'vanished' ? s.kind : `${s.kind} (dx ${s.dx}, dy ${s.dy}, dw ${s.dw}, dh ${s.dh})`;
  return `${scenario} · ${step}: ${s.region} ${d}`;
}
