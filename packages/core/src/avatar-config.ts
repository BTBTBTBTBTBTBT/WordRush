// Build-your-own-mascot avatars (docs/FINISH_SPEC.md AN). The schema, the
// validation (unknown ids fall back to defaults) and the deterministic default
// every player without a photo gets — shared by web, iOS and Android (pinned by
// avatar-config-fixtures.json). The part anchors live in avatar-parts.json
// (a placeholder until the art-av-* art lands; the coordinator replaces it).

import { captionHash } from './share-captions';
import { BOT_CAST } from './bot-cast';

export const AVATAR_BODIES = ['classic', 'tall', 'wide', 'blob', 'bean', 'star'] as const;
export const AVATAR_PATTERNS = ['solid', 'twotone', 'stripes', 'dots', 'gradient', 'sparkle'] as const;
export const AVATAR_EYES = ['beady', 'happy', 'sparkly', 'sleepy', 'wink', 'hearts', 'stars', 'glasses', 'cyclops'] as const;
export const AVATAR_MOUTHS = ['smile', 'grin', 'tongue', 'o', 'cat', 'toothy', 'smirk', 'tiny', 'gasp'] as const;
export const AVATAR_NOSES = ['none', 'button', 'red', 'blush', 'freckles'] as const;
/** Hats (AN addendum: 21 + none). Pro-only: crown, halo, tiara. */
export const AVATAR_HEADS = [
  'none', 'crown', 'party', 'beanie', 'sprout', 'nightcap', 'headphones', 'bow', 'wizard', 'pirate', 'cowboy', 'chef',
  'grad', 'halo', 'flower', 'tophat', 'propeller', 'catears', 'bunnyears', 'tiara', 'viking', 'sweatband',
] as const;
/** Face extras (AN addendum). */
export const AVATAR_FACES = ['none', 'mustache', 'heart-glasses', 'monocle'] as const;
/** Neck / back extras (AN addendum). Pro-only: wings, chain. */
export const AVATAR_NECKS = ['none', 'cape', 'wings', 'bowtie', 'scarf', 'chain'] as const;
export const AVATAR_FRAMES = ['none', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'pro'] as const;

/**
 * Backdrops (AN addendum, the "Backdrop" tab): the tile background behind the
 * mascot everywhere it shows. `auto` (the default) = a light tint of the body
 * color. Pro-only: aurora, galaxy. Colors are drawn by each renderer by kind:
 * solid = colors[0]; gradient = a top-left → bottom-right blend of colors;
 * pattern = colors[0] background + colors[1..] motif (galaxy stars, polka dots,
 * starry stars, sunburst rays, checkers, confetti).
 */
export const AVATAR_BACKDROPS: ReadonlyArray<{ id: string; kind: 'solid' | 'gradient' | 'pattern'; colors: readonly string[] }> = [
  { id: 'lilac', kind: 'solid', colors: ['#ede9fe'] },
  { id: 'bubblegum', kind: 'solid', colors: ['#fce7f3'] },
  { id: 'sky', kind: 'solid', colors: ['#e0f2fe'] },
  { id: 'mint', kind: 'solid', colors: ['#dcfce7'] },
  { id: 'lemon', kind: 'solid', colors: ['#fef9c3'] },
  { id: 'peach', kind: 'solid', colors: ['#ffedd5'] },
  { id: 'cloud', kind: 'solid', colors: ['#f1f5f9'] },
  { id: 'night', kind: 'solid', colors: ['#1e1b4b'] },
  { id: 'sunset', kind: 'gradient', colors: ['#fb923c', '#ec4899'] },
  { id: 'ocean', kind: 'gradient', colors: ['#0ea5e9', '#1e40af'] },
  { id: 'cottoncandy', kind: 'gradient', colors: ['#f9a8d4', '#a5b4fc'] },
  { id: 'aurora', kind: 'gradient', colors: ['#34d399', '#8b5cf6', '#0ea5e9'] },
  { id: 'galaxy', kind: 'pattern', colors: ['#4c1d95', '#fde68a'] },
  { id: 'polka', kind: 'pattern', colors: ['#fce7f3', '#f472b6'] },
  { id: 'starry', kind: 'pattern', colors: ['#1e3a8a', '#facc15'] },
  { id: 'sunburst', kind: 'pattern', colors: ['#fde68a', '#f59e0b'] },
  { id: 'checkers', kind: 'pattern', colors: ['#ede9fe', '#c4b5fd'] },
  { id: 'confetti', kind: 'pattern', colors: ['#fff7ed', '#ec4899', '#22c55e', '#2563eb', '#f5a524'] },
];
export const AVATAR_BACKDROP_IDS: readonly string[] = ['auto', ...AVATAR_BACKDROPS.map((b) => b.id)];

/** The 16 swatches: the cast palette (12) + 4 extras. Ids are stable (stored); hexes are the tint. */
export const AVATAR_COLORS: ReadonlyArray<{ id: string; hex: string }> = [
  { id: 'purple', hex: '#7c3aed' }, { id: 'violet', hex: '#8b5cf6' }, { id: 'pink', hex: '#ec4899' }, { id: 'red', hex: '#ef4444' },
  { id: 'orange', hex: '#f97316' }, { id: 'amber', hex: '#f5a524' }, { id: 'yellow', hex: '#eab308' }, { id: 'green', hex: '#22c55e' },
  { id: 'emerald', hex: '#10b981' }, { id: 'teal', hex: '#0d9488' }, { id: 'sky', hex: '#0ea5e9' }, { id: 'blue', hex: '#2563eb' },
  { id: 'lilac', hex: '#c4b5fd' }, { id: 'peach', hex: '#fdba74' }, { id: 'mint', hex: '#86efac' }, { id: 'slate', hex: '#64748b' },
];

export type AvatarBody = (typeof AVATAR_BODIES)[number];
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number];
export type AvatarEyes = (typeof AVATAR_EYES)[number];
export type AvatarMouth = (typeof AVATAR_MOUTHS)[number];
export type AvatarNose = (typeof AVATAR_NOSES)[number];
export type AvatarHead = (typeof AVATAR_HEADS)[number];
export type AvatarFace = (typeof AVATAR_FACES)[number];
export type AvatarNeck = (typeof AVATAR_NECKS)[number];
export type AvatarFrame = (typeof AVATAR_FRAMES)[number];

/** profiles.avatar_config (jsonb). */
export interface AvatarConfig {
  v: 1;
  body: AvatarBody;
  /** A swatch id from AVATAR_COLORS. */
  color: string;
  pattern: AvatarPattern;
  patternColor: string;
  eyes: AvatarEyes;
  nose: AvatarNose;
  mouth: AvatarMouth;
  head: AvatarHead;
  face: AvatarFace;
  neck: AvatarNeck;
  frame: AvatarFrame;
  /** The backdrop id (AVATAR_BACKDROP_IDS); 'auto' = a light tint of the body color. */
  bg: string;
  /**
   * Which avatar shows for a player who has a photo: their photo or their
   * mascot. Picking the mascot never clears avatar_url. Default: 'photo' when
   * the profile has avatar_url, else 'mascot'.
   */
  display: AvatarDisplay;
}

export type AvatarDisplay = 'mascot' | 'photo';

/** Pro-only options (free players see the gold PRO pill → the Go Pro popup). */
export const AVATAR_PRO_ONLY: Readonly<{ head: readonly AvatarHead[]; neck: readonly AvatarNeck[]; frame: readonly AvatarFrame[]; bg: readonly string[] }> = {
  head: ['crown', 'halo', 'tiara'],
  neck: ['wings', 'chain'],
  frame: ['diamond', 'pro'],
  bg: ['aurora', 'galaxy'],
};

/** The friendly subsets the deterministic default picks from (never the odd ones). */
const DEFAULT_EYES: readonly AvatarEyes[] = ['beady', 'happy', 'sparkly', 'wink'];
const DEFAULT_MOUTHS: readonly AvatarMouth[] = ['smile', 'grin', 'tiny', 'cat'];
const DEFAULT_BODIES: readonly AvatarBody[] = ['classic', 'tall', 'wide', 'blob', 'bean'];

function hexRgb(hex: string): [number, number, number] | null {
  const h = hex.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** The swatch id nearest an accent hex (squared RGB distance; ties → the earlier swatch). Unknown → 'purple'. */
export function nearestAvatarColor(accentHex: string | null | undefined): string {
  const a = accentHex ? hexRgb(accentHex) : null;
  if (!a) return 'purple';
  let best = AVATAR_COLORS[0].id;
  let bestD = Infinity;
  for (const c of AVATAR_COLORS) {
    const b = hexRgb(c.hex)!;
    const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bestD) { bestD = d; best = c.id; }
  }
  return best;
}

/**
 * The deterministic friendly default for a player without a saved mascot or
 * photo, seeded by the player's LOWERCASED USERNAME (parity: Android's
 * renderers only receive the username; guests pass 'guest'): body / eyes /
 * mouth by FNV-1a(seed) (bits 0–7, 8–15, 16–23
 * picking from the friendly subsets), the player's accent as the color, solid,
 * no nose, no accessory, no frame, the 'auto' backdrop; display = 'photo'
 * when `hasPhoto` (the profile has avatar_url), else 'mascot'.
 */
export function defaultAvatar(seed: string, accentHex?: string | null, hasPhoto = false): AvatarConfig {
  const h = captionHash(seed || 'guest');
  const color = nearestAvatarColor(accentHex);
  return {
    v: 1,
    body: DEFAULT_BODIES[(h & 0xff) % DEFAULT_BODIES.length],
    color,
    pattern: 'solid',
    patternColor: color,
    eyes: DEFAULT_EYES[((h >>> 8) & 0xff) % DEFAULT_EYES.length],
    nose: 'none',
    mouth: DEFAULT_MOUTHS[((h >>> 16) & 0xff) % DEFAULT_MOUTHS.length],
    head: 'none',
    face: 'none',
    neck: 'none',
    frame: 'none',
    bg: 'auto',
    display: hasPhoto ? 'photo' : 'mascot',
  };
}

const COLOR_IDS = new Set(AVATAR_COLORS.map((c) => c.id));
function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/**
 * A stored / incoming config made safe: every unknown or missing field falls
 * back to `fallback` (default: the classic purple mascot). Non-objects → the
 * fallback. Pass `defaultAvatar(userId, accent, hasPhoto)` as the fallback so
 * `display` falls back to 'photo' for players with a photo.
 */
export function validateAvatar(raw: unknown, fallback: AvatarConfig = defaultAvatar('')): AvatarConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...fallback };
  const r = raw as Record<string, unknown>;
  const color = typeof r.color === 'string' && COLOR_IDS.has(r.color) ? r.color : fallback.color;
  const patternColor = typeof r.patternColor === 'string' && COLOR_IDS.has(r.patternColor) ? r.patternColor : color;
  return {
    v: 1,
    body: pick(r.body, AVATAR_BODIES, fallback.body),
    color,
    pattern: pick(r.pattern, AVATAR_PATTERNS, fallback.pattern),
    patternColor,
    eyes: pick(r.eyes, AVATAR_EYES, fallback.eyes),
    nose: pick(r.nose, AVATAR_NOSES, fallback.nose),
    mouth: pick(r.mouth, AVATAR_MOUTHS, fallback.mouth),
    head: pick(r.head, AVATAR_HEADS, fallback.head),
    face: pick(r.face, AVATAR_FACES, fallback.face),
    neck: pick(r.neck, AVATAR_NECKS, fallback.neck),
    frame: pick(r.frame, AVATAR_FRAMES, fallback.frame),
    bg: typeof r.bg === 'string' && AVATAR_BACKDROP_IDS.includes(r.bg) ? r.bg : fallback.bg ?? 'auto',
    display: r.display === 'mascot' || r.display === 'photo' ? r.display : fallback.display ?? 'mascot',
  };
}

/** Strip Pro-only picks for a free player (crown → none, Pro frames → none). */
export function enforceAvatarPro(c: AvatarConfig, isPro: boolean): AvatarConfig {
  if (isPro) return c;
  return {
    ...c,
    head: AVATAR_PRO_ONLY.head.includes(c.head) ? 'none' : c.head,
    neck: AVATAR_PRO_ONLY.neck.includes(c.neck) ? 'none' : c.neck,
    frame: AVATAR_PRO_ONLY.frame.includes(c.frame) ? 'none' : c.frame,
    bg: AVATAR_PRO_ONLY.bg.includes(c.bg) ? 'auto' : c.bg,
  };
}

/** Color swatch hex for a swatch id (unknown → purple). */
export function avatarColorHex(id: string): string {
  return AVATAR_COLORS.find((c) => c.id === id)?.hex ?? '#7c3aed';
}

/**
 * The ten cast presets ("Start from W" …): the classic body in the character's
 * bot-cast color (nearest swatch), beady eyes + smile, solid, no accessory.
 * (Per-character flourishes can be tuned once the art lands.)
 */
export function castPreset(castId: string): AvatarConfig {
  const member = BOT_CAST.find((b) => b.castId === castId);
  const color = nearestAvatarColor(member?.color);
  return { v: 1, body: 'classic', color, pattern: 'solid', patternColor: color, eyes: 'beady', nose: 'none', mouth: 'smile', head: 'none', face: 'none', neck: 'none', frame: 'none', bg: 'auto', display: 'mascot' };
}

// ---------------------------------------------------------------------------
// FINISH_SPEC BJ5 (founder 10-03: "I updated my profile pic and it isn't
// populating"): ONE avatar resolver, the same precedence on every surface of
// every platform (boards, podiums, Friends, VS, profiles, records, shares):
//   1. the player's custom photo when display = 'photo';
//   2. else their saved mascot (avatar_config);
//   3. else the cast hero they wear (avatar_cast_id) as its preset;
//   4. else the deterministic seeded mascot (defaultAvatar by username).
// avatar_frame fills a config without its own frame. A photo is "custom" when
// the player chose it: uploaded to our avatars bucket, or explicitly picked
// (a saved config with display = 'photo'). An OAuth provider picture with no
// saved choice (Google's default is a plain colored letter) is never drawn —
// the player gets their mascot instead, so no avatar is ever a plain letter tile.

/** The ten cast heroes a player can wear (avatar_cast_id), WORDOCIOUS order. */
export const AVATAR_CAST_IDS = ['w', 'o1', 'r', 'd', 'o2', 'c', 'i', 'o3', 'u', 's'] as const;

/** True for a photo the player uploaded (the public `avatars` storage bucket). */
export function isCustomPhotoUrl(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.includes('/storage/v1/object/public/avatars/');
}

/** Everything a row may carry about a player's look (any field may be missing). */
export interface AvatarSource {
  username?: string | null;
  avatarUrl?: string | null;
  /** profiles.avatar_config, any shape (validated). */
  config?: unknown;
  /** profiles.avatar_cast_id. */
  castId?: unknown;
  /** profiles.avatar_frame. */
  frame?: unknown;
  /** profiles.accent_color → the seeded mascot's color. */
  accentHex?: string | null;
}

export type AvatarSourceKind = 'photo' | 'config' | 'cast' | 'seeded';

export interface ResolvedAvatar {
  /** Which rung of the precedence won. */
  kind: AvatarSourceKind;
  /** The photo to draw (kind 'photo' only), else null. */
  photoUrl: string | null;
  /** The mascot (drawn when photoUrl is null; its frame rings the photo otherwise). */
  config: AvatarConfig;
}

function knownFrame(v: unknown): AvatarFrame | null {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase();
  return k !== 'none' && (AVATAR_FRAMES as readonly string[]).includes(k) ? (k as AvatarFrame) : null;
}

function knownCast(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase();
  return (AVATAR_CAST_IDS as readonly string[]).includes(k) ? k : null;
}

/** BJ5: the one avatar precedence (see above). Pure; pinned by avatar-resolve-fixtures.json. */
export function resolveAvatar(src: AvatarSource): ResolvedAvatar {
  const seed = (src.username ?? '').trim().toLowerCase();
  const accent = src.accentHex ?? null;
  const url = typeof src.avatarUrl === 'string' && src.avatarUrl.trim().length > 0 ? src.avatarUrl.trim() : null;
  const custom = url !== null && isCustomPhotoUrl(url);
  const frame = knownFrame(src.frame);
  const cast = knownCast(src.castId);
  const framed = (c: AvatarConfig): AvatarConfig => (c.frame === 'none' && frame ? { ...c, frame } : c);
  const raw = src.config;
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw as object).length > 0) {
    const saved = framed(validateAvatar(raw, defaultAvatar(seed, accent, custom)));
    if (url !== null && saved.display === 'photo') return { kind: 'photo', photoUrl: url, config: saved };
    return { kind: 'config', photoUrl: null, config: saved };
  }
  if (custom) {
    const base = cast ? castPreset(cast) : defaultAvatar(seed, accent, true);
    return { kind: 'photo', photoUrl: url, config: framed({ ...base, display: 'photo' }) };
  }
  if (cast) return { kind: 'cast', photoUrl: null, config: framed(castPreset(cast)) };
  return { kind: 'seeded', photoUrl: null, config: framed(defaultAvatar(seed, accent, false)) };
}
