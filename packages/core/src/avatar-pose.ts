// Poses + the living mascot (docs/cloud-prompts/06, docs/design/brand/avatar/rigs/REPORT-BODY-RIGS.md).
//
// Every player body is rigged ONCE by docs/design/brand/avatar/integration/rig-body.py: the white body art is cut
// into four layers (feet behind, base, two mitten arms) at the measured landmarks, so tint still works and the rest
// pose is the body exactly. Poses are SHARED DATA (avatar-poses.json): a rotation / offset per limb plus a small body
// squash, so a new body gets every pose for free. This module turns a pose into per-layer affine matrices (body
// units), and evaluates the living mascot (breathe, blink, its saved pose, tap = hop + laugh, moment reactions).
// Pure; pinned across TS / Swift / Kotlin by avatar-pose-fixtures.json.
//
// Everything new ships behind AVATAR_LIVE_CONFIG.livingMascot (OFF): with it off no surface draws a pose, the Pose
// tab is hidden and every mascot renders exactly as before.

import posesJson from './avatar-poses.json';

/** The feature flag + performance rules (founder: smooth over pretty). */
export const AVATAR_LIVE_CONFIG = {
  /**
   * Defaults OFF; the app turns it on from the remote `living_mascot` off-switch (fail-open, useLivingMascot) — poses,
   * the Pose tab and the living mascot all stand down while it is off.
   */
  livingMascot: false as boolean,
  /** At most this many mascots animate on one screen (the player's own first); the rest hold their pose frame. */
  maxAnimated: 3,
  /** Android holds still between moves (like the cast): breathing only while a move / reaction plays. */
  androidIdleStill: true,
};

/** The pose ids (stored in the avatar config's `pose`; 'none' = the body as drawn). */
export const AVATAR_POSES = ['none', 'wave', 'cheer', 'hips', 'shrug', 'flex', 'hug', 'sit', 'jump'] as const;
export type AvatarPose = (typeof AVATAR_POSES)[number];

/** [a, b, c, d, e, f]: x' = a·x + c·y + e, y' = b·x + d·y + f (the canvas / SVG / CGAffineTransform order). */
export type AvatarMatrix = [number, number, number, number, number, number];
export const AVATAR_IDENTITY: AvatarMatrix = [1, 0, 0, 1, 0, 0];

export interface AvatarPoseLimb { rot?: number; dx?: number; dy?: number }
export interface AvatarPoseSpec {
  arms?: { L?: AvatarPoseLimb; R?: AvatarPoseLimb };
  body?: { dy?: number; rot?: number; sx?: number; sy?: number };
  feet?: { dy?: number; sx?: number; sy?: number };
}
export interface AvatarPoseDef extends AvatarPoseSpec {
  label: string;
  /** Living extras: a waving arm, a cheer bounce. */
  live?: { wave?: { limb: 'L' | 'R'; amp: number; period: number }; bounce?: { amp: number; period: number }; /** Both arms swing together (the podium's 2nd-place applause). */ clap?: { amp: number; period: number } };
}
/** A rigged body (body units): shoulder pivots, hand centers, the hip-line center (feet pivot), the floor. */
export interface AvatarBodyRig {
  armL: { pivot: [number, number]; hand: [number, number]; handR: [number, number]; box?: [number, number, number, number] };
  armR: { pivot: [number, number]; hand: [number, number]; handR: [number, number]; box?: [number, number, number, number] };
  feet: { pivot: [number, number]; box?: [number, number, number, number] };
  floor: number;
  hips: number;
}
export interface AvatarPosesData {
  version: number;
  poses: Record<string, AvatarPoseDef>;
  /** Poses that need a new hand drawing (ChatGPT limb art), not shipped. */
  needsHandArt: string[];
  rigs: Record<string, AvatarBodyRig>;
  /** pose → body → item keys withheld in that pose (they fail the guards there). */
  withheld: Record<string, Record<string, string[]>>;
}

export const AVATAR_POSES_DATA = posesJson as unknown as AvatarPosesData;

/** The four rig layers, back → front: feet, base, armL, armR. Art: art-av-body-<body>-<part>. */
export const AVATAR_RIG_PARTS = ['feet', 'base', 'armL', 'armR'] as const;
export type AvatarRigPart = (typeof AVATAR_RIG_PARTS)[number];
/**
 * What a layer moves with: a rig part, 'root' (the body), 'none' (pets stay on the floor), or a hand (held items:
 * they follow the hand's position and tilt with it only a little, so a raised mug stays upright).
 */
export type AvatarRide = 'root' | 'armL' | 'armR' | 'handL' | 'handR' | 'feet' | 'none';
/** A held item tilts with its hand at most this much (degrees). */
export const AVATAR_HELD_TILT = 30;

export const r5 = (v: number) => Math.round(v * 100000) / 100000;

export function matMul(m: AvatarMatrix, n: AvatarMatrix): AvatarMatrix {
  return [
    m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}
const T = (x: number, y: number): AvatarMatrix => [1, 0, 0, 1, x, y];
const S = (x: number, y: number): AvatarMatrix => [x, 0, 0, y, 0, 0];
const Rd = (deg: number): AvatarMatrix => {
  const r = (deg * Math.PI) / 180;
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
};
const chain = (...ms: AvatarMatrix[]): AvatarMatrix => ms.reduce((a, b) => matMul(a, b), AVATAR_IDENTITY);

/** A point through a matrix. */
export function matApply(m: AvatarMatrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

export function avatarBodyRig(body: string, data: AvatarPosesData = AVATAR_POSES_DATA): AvatarBodyRig | null {
  return data.rigs[body] ?? null;
}

/**
 * Poses composed in code, never saved by a player and never in the Pose tab: the podium's 2nd-place applause. Its arms
 * start from the shipped hug-self pose's rig fit (same withheld list), brought up to chest height, and swing together.
 */
export const AVATAR_CODE_POSES: Readonly<Record<string, AvatarPoseDef>> = {
  clap: {
    label: 'Clap',
    arms: { L: { rot: -66, dx: -0.1, dy: 0.01 }, R: { rot: -66, dx: -0.1, dy: 0.01 } },
    body: { sx: 0.985 },
    live: { clap: { amp: 12, period: 0.36 } },
  },
};
/** A code pose's shipped stand-in for the per-pose guards (withheld items). */
const CODE_POSE_GUARD: Readonly<Record<string, string>> = { clap: 'hug' };

export function avatarPoseDef(pose: string | null | undefined, data: AvatarPosesData = AVATAR_POSES_DATA): AvatarPoseDef | null {
  return pose && pose !== 'none' ? data.poses[pose] ?? AVATAR_CODE_POSES[pose] ?? null : null;
}

/** The pose a podium place stands in: 1st cheers, 2nd claps, 3rd waves, everyone else the body as drawn. */
export function avatarPlacePose(place: number): AvatarPose | 'clap' {
  return place === 1 ? 'cheer' : place === 2 ? 'clap' : place === 3 ? 'wave' : 'none';
}

/**
 * The per-part matrices (body units) of a pose spec on a rigged body. Arm rot is OUTWARD-positive degrees about
 * the shoulder pivot for both sides (the viewer's-right arm is mirrored), dx outward-positive, dy down-positive. The
 * body squashes / tilts about the middle of the hip line (so it never parts from the feet); body dy lifts the feet
 * too; the feet squash about the floor. Reference: rig-body.py pose_mats.
 */
export function avatarPoseMatrices(rig: AvatarBodyRig, spec: AvatarPoseSpec): Record<Exclude<AvatarRide, 'none'> | 'base', AvatarMatrix> {
  const b = spec.body ?? {};
  const [hx, hy] = rig.feet.pivot;
  const lift = T(0, b.dy ?? 0);
  const root = chain(lift, T(hx, hy), Rd(b.rot ?? 0), S(b.sx ?? 1, b.sy ?? 1), T(-hx, -hy));
  const arm = (side: 'L' | 'R'): AvatarMatrix => {
    const q = spec.arms?.[side] ?? {};
    const sg = side === 'L' ? 1 : -1;
    const [px, py] = (side === 'L' ? rig.armL : rig.armR).pivot;
    return chain(root, T(px - sg * (q.dx ?? 0), py + (q.dy ?? 0)), Rd(sg * (q.rot ?? 0)), T(-px, -py));
  };
  const f = spec.feet ?? {};
  const feet = chain(lift, T(hx, rig.floor + (f.dy ?? 0)), S(f.sx ?? 1, f.sy ?? 1), T(-hx, -rig.floor));
  const armL = arm('L'), armR = arm('R');
  // a hand: moves the rest hand center to where the arm carries it, tilted by the arm's angle clamped to ±HELD_TILT
  const hand = (m: AvatarMatrix, h: [number, number]): AvatarMatrix => {
    const [x, y] = matApply(m, h[0], h[1]);
    const deg = (Math.atan2(m[1], m[0]) * 180) / Math.PI;
    const tilt = Math.max(-AVATAR_HELD_TILT, Math.min(AVATAR_HELD_TILT, deg));
    const k = Math.sqrt(Math.abs(root[0] * root[3] - root[1] * root[2]));
    return chain(T(x, y), Rd(tilt), S(k, k), T(-h[0], -h[1]));
  };
  return { root, base: root, armL, armR, handL: hand(armL, rig.armL.hand), handR: hand(armR, rig.armR.hand), feet };
}

/** Items withheld in a pose on a body (they fail the per-pose guards; rig-body.py --guards logs why). */
export function avatarPoseWithheld(pose: string | null | undefined, body: string, data: AvatarPosesData = AVATAR_POSES_DATA): readonly string[] {
  if (!pose || pose === 'none') return [];
  return data.withheld[CODE_POSE_GUARD[pose] ?? pose]?.[body] ?? [];
}

// ── The living mascot ───────────────────────────────────────────────────────────────────────────────────────────

/** A moment the mascot reacts to (win = cheer, loss = shrug, streak +1 = hop, level up = cheer). */
export type AvatarReaction = 'win' | 'loss' | 'streak' | 'levelup' | 'sweep' | 'flawless' | 'progress';
export const AVATAR_REACTION_POSE: Readonly<Record<AvatarReaction, AvatarPose>> = {
  win: 'cheer', loss: 'shrug', streak: 'none', levelup: 'cheer',
  // 2.8 item 13: a sweep / flawless is a bigger, longer cheer; "progress" (a counter ticked up: 7 -> 8 OF 18) a short wave.
  sweep: 'cheer', flawless: 'cheer', progress: 'wave',
};
/** How long a reaction plays (s); streak is a hop. */
export const AVATAR_REACTION_SECONDS: Readonly<Record<AvatarReaction, number>> = {
  win: 2.4, loss: 2.2, streak: 0.9, levelup: 2.6, sweep: 3.2, flawless: 4, progress: 1.6,
};
/** The hops a reaction makes: how many, one every `per` s, `amp` tall (body units). Reactions not listed do not hop. */
export const AVATAR_REACTION_HOPS: Readonly<Partial<Record<AvatarReaction, { n: number; per: number; amp: number }>>> = {
  streak: { n: 1, per: 0.6, amp: 0.06 },
  win: { n: 2, per: 0.55, amp: 0.06 },
  levelup: { n: 2, per: 0.55, amp: 0.06 },
  sweep: { n: 3, per: 0.55, amp: 0.07 },
  flawless: { n: 4, per: 0.55, amp: 0.09 },
  progress: { n: 1, per: 0.5, amp: 0.04 },
};
/** The tap: hop + laugh (same feel as the cast's tap). */
export const AVATAR_TAP = { dur: 1.1, hop: 0.07, hopT: [0.06, 0.5] as [number, number], laughIn: 0.08, laughOut: 0.85 } as const;
/** Ease between the saved pose and a reaction / back (s). */
export const AVATAR_POSE_BLEND = 0.22;

export interface AvatarLiveInput {
  /** The saved pose ('none' = the body as drawn). */
  pose: string;
  /** Wall clock (s). */
  t: number;
  /** Seconds since a tap, else null. */
  tap?: number | null;
  /** A reaction playing + seconds since it started, else null. */
  reaction?: { kind: AvatarReaction; t: number } | null;
  /** Press-and-hold squish (0 → 1). */
  press?: number;
  /** Reduce Motion: the saved pose holds; a tap only shows the laugh. */
  still?: boolean;
  /** Ambient off (Android between moves): no breathing / waving, blinks keep going. */
  ambient?: boolean;
  /** A per-mascot blink seed (the cast's LCG). */
  blinkSeed?: number;
}

export interface AvatarLiveFrame {
  spec: AvatarPoseSpec;
  /** Eyes scaleY about their center: 1 open, ~0.1 closed (blink), 0.45 happy squint (laugh). */
  eyes: number;
  /** 0 → 1: the laughing face (the mouth stretches open 1.25×). */
  laugh: number;
}

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const smooth = (x: number) => { const c = Math.min(1, Math.max(0, x)); return c * c * (3 - 2 * c); };

function limbLerp(a: AvatarPoseLimb = {}, b: AvatarPoseLimb = {}, k: number): AvatarPoseLimb {
  return { rot: lerp(a.rot ?? 0, b.rot ?? 0, k), dx: lerp(a.dx ?? 0, b.dx ?? 0, k), dy: lerp(a.dy ?? 0, b.dy ?? 0, k) };
}

/** Blend two pose specs (k = 0 → a, 1 → b). */
export function avatarPoseLerp(a: AvatarPoseSpec, b: AvatarPoseSpec, k: number): AvatarPoseSpec {
  const ab = a.body ?? {}, bb = b.body ?? {}, af = a.feet ?? {}, bf = b.feet ?? {};
  return {
    arms: { L: limbLerp(a.arms?.L, b.arms?.L, k), R: limbLerp(a.arms?.R, b.arms?.R, k) },
    body: { dy: lerp(ab.dy ?? 0, bb.dy ?? 0, k), rot: lerp(ab.rot ?? 0, bb.rot ?? 0, k), sx: lerp(ab.sx ?? 1, bb.sx ?? 1, k), sy: lerp(ab.sy ?? 1, bb.sy ?? 1, k) },
    feet: { dy: lerp(af.dy ?? 0, bf.dy ?? 0, k), sx: lerp(af.sx ?? 1, bf.sx ?? 1, k), sy: lerp(af.sy ?? 1, bf.sy ?? 1, k) },
  };
}

/** The cast's blink schedule (same LCG as cast-rig blinkTimes): blink starts every 3–5 s. */
export function avatarBlinkTimes(seed: number, start = 1.3, until = 600): number[] {
  const out: number[] = [];
  let t = start;
  let s = seed;
  while (t < until) {
    out.push(t);
    s = (s * 9301 + 49297) % 233280;
    t += 3 + 2 * (s / 233280);
  }
  return out;
}
const blinkCache = new Map<number, number[]>();
function blinkAt(seed: number, t: number): number {
  let bl = blinkCache.get(seed);
  if (!bl) { bl = avatarBlinkTimes(seed); blinkCache.set(seed, bl); }
  const tt = ((t % 600) + 600) % 600;
  for (const b of bl) {
    if (b > tt) break;
    const d = tt - b;
    if (d < 0.16) return d < 0.04 || d > 0.12 ? 0.5 : 0.1;
  }
  return 1;
}

/** One frame of the living mascot: the pose spec to draw + the face. Pure (same input → same frame). */
export function avatarLiveFrame(input: AvatarLiveInput, data: AvatarPosesData = AVATAR_POSES_DATA): AvatarLiveFrame {
  const { t, still = false, ambient = true } = input;
  const saved = avatarPoseDef(input.pose, data);
  let spec: AvatarPoseSpec = saved ?? {};
  // a reaction blends in, holds, and blends back to the saved pose
  const rx = input.reaction;
  let hop = 0;
  if (rx && !still) {
    const dur = AVATAR_REACTION_SECONDS[rx.kind];
    if (rx.t >= 0 && rx.t < dur) {
      const target = avatarPoseDef(AVATAR_REACTION_POSE[rx.kind], data) ?? saved ?? {};
      const k = smooth(Math.min(rx.t, dur - rx.t) / AVATAR_POSE_BLEND);
      spec = avatarPoseLerp(spec, target, k);
      const hops = AVATAR_REACTION_HOPS[rx.kind];
      if (hops) {
        // a hop (the cheers hop twice; a sweep three times, a flawless four)
        const tt = rx.t - 0.1;
        if (tt > 0 && tt < hops.per * hops.n) hop = Math.max(hop, hops.amp * Math.sin(((tt % hops.per) / hops.per) * Math.PI));
      }
    }
  }
  const live = (rx && !still && rx.t < AVATAR_REACTION_SECONDS[rx.kind] ? avatarPoseDef(AVATAR_REACTION_POSE[rx.kind], data)?.live : undefined) ?? saved?.live;
  const body = { dy: 0, rot: 0, sx: 1, sy: 1, ...(spec.body ?? {}) };
  const arms = { L: { ...(spec.arms?.L ?? {}) }, R: { ...(spec.arms?.R ?? {}) } };
  const feet = { ...(spec.feet ?? {}) };
  if (!still && ambient) {
    // breathing (the cast's 3.4 s breath) + the pose's own idle motion
    const br = Math.sin((t / 3.4) * Math.PI * 2);
    body.sy *= 1 + 0.012 * br;
    body.sx *= 1 - 0.006 * br;
    if (live?.wave) {
      const a = arms[live.wave.limb];
      a.rot = (a.rot ?? 0) + live.wave.amp * Math.sin((t / live.wave.period) * Math.PI * 2);
    }
    if (live?.bounce) body.dy -= live.bounce.amp * Math.abs(Math.sin((t / live.bounce.period) * Math.PI));
    if (live?.clap) {
      // both arms swing together (inward-positive is negative rot, so the same sign brings the hands together)
      const swing = live.clap.amp * Math.sin((t / live.clap.period) * Math.PI * 2);
      arms.L.rot = (arms.L.rot ?? 0) + swing;
      arms.R.rot = (arms.R.rot ?? 0) + swing;
    }
  }
  // the tap: hop + squash + laugh (Reduce Motion: only the laugh)
  let laugh = 0;
  const tap = input.tap;
  if (tap !== null && tap !== undefined && tap >= 0 && tap < AVATAR_TAP.dur) {
    laugh = smooth(tap / AVATAR_TAP.laughIn) * (1 - smooth((tap - AVATAR_TAP.laughOut) / (AVATAR_TAP.dur - AVATAR_TAP.laughOut)));
    if (!still) {
      const [h0, h1] = AVATAR_TAP.hopT;
      if (tap >= h0 && tap < h1) hop = Math.max(hop, AVATAR_TAP.hop * Math.sin(((tap - h0) / (h1 - h0)) * Math.PI));
      const sq = tap < h0 ? -0.06 * (tap / h0) : tap < h1 ? 0.04 * Math.sin(((tap - h0) / (h1 - h0)) * Math.PI) : -0.05 * Math.sin(Math.min(1, (tap - h1) / 0.25) * Math.PI);
      body.sy *= 1 + sq;
      body.sx *= 1 - sq * 0.6;
      // arms fly up a little on the hop
      for (const s of ['L', 'R'] as const) arms[s].rot = (arms[s].rot ?? 0) + 40 * (hop / AVATAR_TAP.hop);
    }
  }
  if (hop) body.dy -= hop;
  const press = still ? 0 : input.press ?? 0;
  if (press) { body.sy *= 1 - 0.08 * press; body.sx *= 1 + 0.06 * press; }
  let eyes = still ? 1 : blinkAt(input.blinkSeed ?? 7, t);
  if (laugh > 0.5) eyes = 0.45;
  const r = (v: number | undefined, d: number) => r5(v ?? d);
  const limb = (l: AvatarPoseLimb) => ({ rot: r(l.rot, 0), dx: r(l.dx, 0), dy: r(l.dy, 0) });
  return {
    spec: {
      arms: { L: limb(arms.L), R: limb(arms.R) },
      body: { dy: r5(body.dy), rot: r5(body.rot), sx: r5(body.sx), sy: r5(body.sy) },
      feet: { dy: r(feet.dy, 0), sx: r(feet.sx, 1), sy: r(feet.sy, 1) },
    },
    eyes,
    laugh: r5(laugh),
  };
}

/** The poses the living mascot's fit leaves room for (its reactions + the tap hop never leave the tile). */
export const AVATAR_LIVE_ROOM: readonly AvatarPoseSpec[] = [
  AVATAR_POSES_DATA.poses.cheer, AVATAR_POSES_DATA.poses.shrug, AVATAR_POSES_DATA.poses.wave,
  { body: { dy: -0.09 }, arms: { L: { rot: 40 }, R: { rot: 40 } } },
].filter(Boolean);

/** The laugh's pitch per body (the cast laugh sounds, pitched: small bodies higher, big ones lower). */
export const AVATAR_LAUGH_RATE: Readonly<Record<string, number>> = {
  mini: 1.32, bean: 1.16, star: 1.12, drop: 1.1, tall: 1.04, classic: 1.0, hex: 0.98, cloud: 0.96, pear: 0.94, blob: 0.92, wide: 0.88, chunky: 0.84,
  // the 18 new bodies (10-09): small / spiky shapes laugh quicker, round heavy ones slower
  heart: 1.06, moon: 0.96, egg: 1.0, bell: 0.98, triangle: 1.04, diamond: 1.08, shield: 0.92, burst: 1.12, flower: 1.06, gumdrop: 1.1, can: 0.94, potato: 0.9, catear: 1.08, bunnyear: 1.12, pumpkin: 0.9, ghost: 1.04, cone: 1.02, bat: 1.14,
};
