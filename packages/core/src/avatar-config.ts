// Build-your-own-mascot avatars (docs/FINISH_SPEC.md AN). The schema, the
// validation (unknown ids fall back to defaults) and the deterministic default
// every player without a photo gets — shared by web, iOS and Android (pinned by
// avatar-config-fixtures.json). The part anchors live in avatar-parts.json
// (a placeholder until the art-av-* art lands; the coordinator replaces it).

import { captionHash } from './share-captions';
import { BOT_CAST } from './bot-cast';
import { AVATAR_POSES } from './avatar-pose';

// Round 2 (founder 10-03: "more body styles, parts and accessories … more options of everything"):
// ~2× every category, a CHEEKS category (blush + freckles moved out of noses), 32 colors + Pro specials,
// 14 patterns, tintable white accessories (accColor). New ids are appended so stored configs stay valid.
export const AVATAR_BODIES = ['classic', 'tall', 'wide', 'blob', 'bean', 'star', 'drop', 'pear', 'cloud', 'chunky', 'mini', 'hex'] as const;
export const AVATAR_PATTERNS = [
  'solid', 'twotone', 'stripes', 'dots', 'gradient', 'sparkle',
  'hearts', 'stars', 'zigzag', 'checkers', 'tiedye', 'leopard', 'galaxy', 'colorblock',
] as const;
export const AVATAR_EYES = [
  'beady', 'happy', 'sparkly', 'sleepy', 'wink', 'hearts', 'stars', 'glasses', 'cyclops',
  'sunglasses', 'determined', 'anime', 'joy', 'droopy', 'biground', 'sideglance', 'dizzy',
] as const;
export const AVATAR_MOUTHS = [
  'smile', 'grin', 'tongue', 'o', 'cat', 'toothy', 'smirk', 'tiny', 'gasp',
  'laugh', 'whistle', 'fang', 'kissy', 'braces', 'oops', 'tongueside', 'teeth',
] as const;
export const AVATAR_NOSES = ['none', 'button', 'red', 'pointy', 'bignose', 'cat', 'piggy', 'clownstar'] as const;
/** Cheeks (round 2): blush + freckles moved here from noses (old configs migrate in validateAvatar). */
export const AVATAR_CHEEKS = ['none', 'blush', 'freckles', 'hearts', 'starfreckles', 'sparkle', 'bandage'] as const;
/** Hats (AN addendum: 21 + round 2: 12, + none). Pro-only: crown, halo, tiara. */
export const AVATAR_HEADS = [
  'none', 'crown', 'party', 'beanie', 'sprout', 'nightcap', 'headphones', 'bow', 'wizard', 'pirate', 'cowboy', 'chef',
  'grad', 'halo', 'flower', 'tophat', 'propeller', 'catears', 'bunnyears', 'tiara', 'viking', 'sweatband',
  'cap', 'beret', 'minicrown', 'flowercrown', 'bucket', 'santa', 'witch', 'astronaut', 'bigbow', 'pombeanie', 'bearears', 'mohawk',
  // seasonal (avatar-parts.json `season`; avatar-season.ts decides when they show): Halloween 10-05
  'pumpkinhat', 'candycornhat', 'witchnight', 'batears',
] as const;
/** Face extras (AN addendum + round 2). */
export const AVATAR_FACES = ['none', 'mustache', 'heart-glasses', 'monocle', 'starglasses', 'roundglasses', 'eyepatch', 'facepaint', 'mask', 'curlymustache'] as const;
/** Neck / back extras (AN addendum + round 2). Pro-only: wings, chain. */
export const AVATAR_NECKS = ['none', 'cape', 'wings', 'bowtie', 'scarf', 'chain', 'medal', 'backpack', 'bubbletea', 'guitar', 'supercape', 'fairywings', 'batwings', 'cattail'] as const;
/**
 * Integrated parts (founder 10-05: "the new items … so long as they don't look bolted on"; docs/design/brand/avatar/
 * INTEGRATION.md). Each one is drawn PER BODY as layer art (avatar-parts.json `pieces`): held items sit in the fist,
 * wraps follow the body's wrap line, shoes go on the feet, companions sit beside, brows + extras on the face.
 * New fields: missing in older configs (= 'none'). Ids are appended only, so stored configs stay valid.
 */
export const AVATAR_HELD = ['none', 'mug', 'book', 'pencil-big', 'balloon', 'trophy', 'magnifier', 'flashlight', 'umbrella', 'icecream', 'spatula', 'mic', 'wand-star', 'candypail'] as const;
/** Body wraps (the necktie and sash were dropped 10-05: no room for a tie blade; the sash read as a stripe across the letter). */
export const AVATAR_WRAPS = ['none', 'bandana', 'belt', 'apron', 'lei', 'cape-drape', 'vampirecollar'] as const;
export const AVATAR_FEET = ['none', 'sneakers', 'boots', 'slippers', 'skates'] as const;
export const AVATAR_PETS = ['none', 'bird', 'kitten', 'puppy', 'snail', 'bat', 'ghost', 'blackcat'] as const;
/** Brows (code-drawn in the eyes' own ink; six friendly pairs, never angry). */
export const AVATAR_BROWS = ['none', 'happy', 'worried', 'determined', 'surprised', 'cheeky', 'sleepy'] as const;
/** Face extras: little expression marks beside the face (never over the eyes, mouth or letter). */
export const AVATAR_EXTRAS = ['none', 'sweat', 'tear', 'steam', 'heart'] as const;
/** The integrated config fields, in the maker's tab order. */
export const AVATAR_INTEGRATED_FIELDS = ['held', 'wrap', 'feet', 'pet', 'brows', 'extra'] as const;
export type AvatarIntegratedField = (typeof AVATAR_INTEGRATED_FIELDS)[number];
/** The options of each integrated field (for the maker's catalog). */
export const AVATAR_INTEGRATED_OPTIONS: Readonly<Record<AvatarIntegratedField, readonly string[]>> = {
  held: AVATAR_HELD, wrap: AVATAR_WRAPS, feet: AVATAR_FEET, pet: AVATAR_PETS, brows: AVATAR_BROWS, extra: AVATAR_EXTRAS,
};
/** Parts that carry the maker's NEW tag (10-05 additions + the 7 rebuilt parts). */
export const AVATAR_NEW_PARTS: readonly string[] = [
  ...AVATAR_HELD.slice(1, 13), ...AVATAR_WRAPS.slice(1, 6), ...AVATAR_FEET.slice(1), ...AVATAR_PETS.slice(1, 5),
  ...AVATAR_BROWS.slice(1).map((b) => `brows:${b}`), ...AVATAR_EXTRAS.slice(1),
  'backpack', 'scarf', 'chain', 'bubbletea', 'guitar', 'cape', 'supercape',
];
/**
 * One-tap looks (the 10-05 "sets"): applying one sets every listed field (the maker resolves conflicts with
 * applyAvatarPick). Pro when any part is Pro-only.
 */
export const AVATAR_BUNDLES: ReadonlyArray<{ id: string; label: string; pro?: boolean; picks: Readonly<Record<string, string>> }> = [
  { id: 'bookworm', label: 'Bookworm', picks: { held: 'book', face: 'roundglasses', brows: 'happy' } },
  { id: 'athlete', label: 'Athlete', picks: { held: 'trophy', head: 'sweatband', feet: 'sneakers', wrap: 'belt' } },
  { id: 'chef', label: 'Chef', picks: { held: 'spatula', wrap: 'apron', head: 'chef' } },
  { id: 'explorer', label: 'Explorer', picks: { neck: 'backpack', held: 'magnifier', head: 'bucket' } },
  { id: 'rockstar', label: 'Rock star', pro: true, picks: { held: 'mic', face: 'starglasses', neck: 'chain' } },
  { id: 'rainyday', label: 'Rainy day', picks: { held: 'umbrella', feet: 'boots' } },
  { id: 'magic', label: 'Magic', pro: true, picks: { held: 'wand-star', wrap: 'cape-drape', head: 'wizard' } },
  { id: 'summer', label: 'Summer', picks: { held: 'icecream', wrap: 'lei' } },
];
/** White glossy accessories that take the accessory color (accColor); everything else keeps its own colors. */
export const AVATAR_TINTABLE: readonly string[] = ['supercape', 'backpack', 'wings', 'chef', 'astronaut'];
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

export type AvatarColorGroup = 'bright' | 'pastel' | 'deep' | 'neutral' | 'special';

/**
 * A body / pattern / accessory swatch. `hex` is the flat tint (and what any single-color use takes);
 * Pro specials also carry `stops` (a gradient tint, `dir` h = left→right, v = top→bottom, d = diagonal)
 * that renderers multiply onto the white art instead of the flat hex.
 */
export interface AvatarColor { id: string; hex: string; group: AvatarColorGroup; pro?: boolean; stops?: readonly string[]; dir?: 'h' | 'v' | 'd' }

/**
 * The swatches, grouped in rows (round 2: 16 → 32 + 5 Pro specials). The first 16 ids are the
 * original catalog (stable: stored); the seeded default only ever picks from those (nearestAvatarColor).
 */
export const AVATAR_COLORS: ReadonlyArray<AvatarColor> = [
  { id: 'purple', hex: '#7c3aed', group: 'bright' }, { id: 'violet', hex: '#8b5cf6', group: 'bright' }, { id: 'pink', hex: '#ec4899', group: 'bright' }, { id: 'red', hex: '#ef4444', group: 'bright' },
  { id: 'orange', hex: '#f97316', group: 'bright' }, { id: 'amber', hex: '#f5a524', group: 'bright' }, { id: 'yellow', hex: '#eab308', group: 'bright' }, { id: 'green', hex: '#22c55e', group: 'bright' },
  { id: 'emerald', hex: '#10b981', group: 'bright' }, { id: 'teal', hex: '#0d9488', group: 'bright' }, { id: 'sky', hex: '#0ea5e9', group: 'bright' }, { id: 'blue', hex: '#2563eb', group: 'bright' },
  { id: 'lilac', hex: '#c4b5fd', group: 'pastel' }, { id: 'peach', hex: '#fdba74', group: 'pastel' }, { id: 'mint', hex: '#86efac', group: 'pastel' }, { id: 'slate', hex: '#64748b', group: 'neutral' },
  // round 2
  { id: 'rose', hex: '#fb7185', group: 'bright' }, { id: 'lime', hex: '#84cc16', group: 'bright' },
  { id: 'bubblegum', hex: '#f9a8d4', group: 'pastel' }, { id: 'babyblue', hex: '#93c5fd', group: 'pastel' }, { id: 'butter', hex: '#fde68a', group: 'pastel' },
  { id: 'coral', hex: '#fca5a5', group: 'pastel' }, { id: 'seafoam', hex: '#99f6e4', group: 'pastel' },
  { id: 'navy', hex: '#1e3a8a', group: 'deep' }, { id: 'plum', hex: '#6b21a8', group: 'deep' }, { id: 'forest', hex: '#166534', group: 'deep' },
  { id: 'maroon', hex: '#881337', group: 'deep' }, { id: 'charcoal', hex: '#374151', group: 'deep' }, { id: 'chocolate', hex: '#78350f', group: 'deep' },
  { id: 'white', hex: '#f8fafc', group: 'neutral' }, { id: 'cream', hex: '#fef3c7', group: 'neutral' }, { id: 'sand', hex: '#d6c7a1', group: 'neutral' }, { id: 'stone', hex: '#a8a29e', group: 'neutral' },
  // Pro-only specials
  { id: 'gold', hex: '#f5b82e', group: 'special', pro: true, stops: ['#fff1b8', '#f5b82e', '#b7791f'], dir: 'v' },
  { id: 'silver', hex: '#cbd5e1', group: 'special', pro: true, stops: ['#ffffff', '#cbd5e1', '#7c8798'], dir: 'v' },
  { id: 'rainbow', hex: '#a855f7', group: 'special', pro: true, stops: ['#ef4444', '#f97316', '#eab308', '#22c55e', '#0ea5e9', '#8b5cf6'], dir: 'h' },
  { id: 'holo', hex: '#c4b5fd', group: 'special', pro: true, stops: ['#f9a8d4', '#c4b5fd', '#99f6e4', '#fde68a', '#f9a8d4'], dir: 'd' },
  { id: 'neon', hex: '#39ff14', group: 'special', pro: true, stops: ['#d9ff6b', '#39ff14', '#00e5a0'], dir: 'd' },
];
export const AVATAR_COLOR_GROUPS: readonly AvatarColorGroup[] = ['bright', 'pastel', 'deep', 'neutral', 'special'];
/** The Pro-only swatches. */
export const AVATAR_PRO_COLORS: readonly string[] = AVATAR_COLORS.filter((c) => c.pro).map((c) => c.id);
/** The seeded default and accent matching only use the original 16 (stable for existing players). */
const NEAREST_POOL = AVATAR_COLORS.slice(0, 16);

export type AvatarBody = (typeof AVATAR_BODIES)[number];
export type AvatarPattern = (typeof AVATAR_PATTERNS)[number];
export type AvatarEyes = (typeof AVATAR_EYES)[number] | 'none';
export type AvatarMouth = (typeof AVATAR_MOUTHS)[number] | 'none';
export type AvatarNose = (typeof AVATAR_NOSES)[number];
export type AvatarCheeks = (typeof AVATAR_CHEEKS)[number];
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
  /** Round 2. Missing in old configs: `nose: 'blush' | 'freckles'` migrates here (validateAvatar). */
  cheeks: AvatarCheeks;
  mouth: AvatarMouth;
  head: AvatarHead;
  face: AvatarFace;
  neck: AvatarNeck;
  /** 10-05 integrated parts (missing = 'none'; validateAvatar writes only the worn ones). */
  held?: string;
  wrap?: string;
  feet?: string;
  pet?: string;
  brows?: string;
  extra?: string;
  /**
   * 10-06 poses (avatar-pose.ts, the Dressing Room's Pose tab): a pose id from AVATAR_POSES. Missing = 'none'
   * (validateAvatar writes it only when set). Drawn only while AVATAR_LIVE_CONFIG.livingMascot is on.
   */
  pose?: string;
  /** The tint for white accessories (AVATAR_TINTABLE): a swatch id, or 'default' (their own white). */
  accColor: string;
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
export const AVATAR_PRO_ONLY: Readonly<{ head: readonly AvatarHead[]; neck: readonly AvatarNeck[]; held: readonly string[]; wrap: readonly string[]; frame: readonly AvatarFrame[]; bg: readonly string[]; color: readonly string[] }> = {
  head: ['crown', 'halo', 'tiara'],
  neck: ['wings', 'chain'],
  held: ['wand-star'],
  wrap: ['cape-drape'],
  frame: ['diamond', 'pro'],
  bg: ['aurora', 'galaxy'],
  color: ['gold', 'silver', 'rainbow', 'holo', 'neon'],
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
  for (const c of NEAREST_POOL) {
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
    cheeks: 'none',
    mouth: DEFAULT_MOUTHS[((h >>> 16) & 0xff) % DEFAULT_MOUTHS.length],
    head: 'none',
    face: 'none',
    neck: 'none',
    accColor: 'default',
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
  // Round 2: blush / freckles were noses; a config without `cheeks` carries them over (nose → none).
  const legacyCheeks = r.cheeks === undefined && (r.nose === 'blush' || r.nose === 'freckles') ? (r.nose as AvatarCheeks) : null;
  return {
    v: 1,
    body: pick(r.body, AVATAR_BODIES, fallback.body),
    color,
    pattern: pick(r.pattern, AVATAR_PATTERNS, fallback.pattern),
    patternColor,
    // Founder 10-05: "you're able to hit None on any body part" — eyes and mouth may be 'none' (draws nothing).
    eyes: r.eyes === 'none' ? 'none' : pick(r.eyes, AVATAR_EYES, fallback.eyes),
    nose: legacyCheeks ? 'none' : pick(r.nose, AVATAR_NOSES, fallback.nose),
    cheeks: legacyCheeks ?? pick(r.cheeks, AVATAR_CHEEKS, fallback.cheeks ?? 'none'),
    mouth: r.mouth === 'none' ? 'none' : pick(r.mouth, AVATAR_MOUTHS, fallback.mouth),
    head: pick(r.head, AVATAR_HEADS, fallback.head),
    face: pick(r.face, AVATAR_FACES, fallback.face),
    neck: pick(r.neck, AVATAR_NECKS, fallback.neck),
    ...integratedPicks(r, fallback),
    ...posePick(r, fallback),
    accColor: typeof r.accColor === 'string' && (r.accColor === 'default' || COLOR_IDS.has(r.accColor)) ? r.accColor : fallback.accColor ?? 'default',
    frame: pick(r.frame, AVATAR_FRAMES, fallback.frame),
    bg: typeof r.bg === 'string' && AVATAR_BACKDROP_IDS.includes(r.bg) ? r.bg : fallback.bg ?? 'auto',
    display: r.display === 'mascot' || r.display === 'photo' ? r.display : fallback.display ?? 'mascot',
  };
}

/**
 * The 10-05 integrated fields of a stored config: only the ones actually worn are written (a missing field is
 * 'none'), so configs saved before they existed — and everyone who never picks one — stay byte-identical.
 */
function integratedPicks(r: Record<string, unknown>, fallback: AvatarConfig): Partial<Record<AvatarIntegratedField, string>> {
  const out: Partial<Record<AvatarIntegratedField, string>> = {};
  for (const f of AVATAR_INTEGRATED_FIELDS) {
    const id = pick(r[f], AVATAR_INTEGRATED_OPTIONS[f], fallback[f] ?? 'none');
    if (id !== 'none') out[f] = id;
  }
  return out;
}

/** The saved pose: written only when it is a known pose other than 'none' (older configs stay byte-identical). */
function posePick(r: Record<string, unknown>, fallback: AvatarConfig): { pose?: string } {
  const id = pick(r.pose, AVATAR_POSES, (fallback.pose ?? 'none') as (typeof AVATAR_POSES)[number]);
  return id !== 'none' ? { pose: id } : {};
}

function stripProIntegrated(c: AvatarConfig): AvatarConfig {
  const out = { ...c };
  if (out.held && AVATAR_PRO_ONLY.held.includes(out.held)) delete out.held;
  if (out.wrap && AVATAR_PRO_ONLY.wrap.includes(out.wrap)) delete out.wrap;
  return out;
}

/** Strip Pro-only picks for a free player (crown → none, Pro frames → none). */
export function enforceAvatarPro(c: AvatarConfig, isPro: boolean): AvatarConfig {
  if (isPro) return c;
  // integrated Pro parts come off (a missing field is 'none', the way validateAvatar writes them)
  const out = stripProIntegrated(c);
  return {
    ...out,
    head: AVATAR_PRO_ONLY.head.includes(c.head) ? 'none' : c.head,
    neck: AVATAR_PRO_ONLY.neck.includes(c.neck) ? 'none' : c.neck,
    frame: AVATAR_PRO_ONLY.frame.includes(c.frame) ? 'none' : c.frame,
    bg: AVATAR_PRO_ONLY.bg.includes(c.bg) ? 'auto' : c.bg,
    color: AVATAR_PRO_ONLY.color.includes(c.color) ? 'purple' : c.color,
    patternColor: AVATAR_PRO_ONLY.color.includes(c.patternColor) ? (AVATAR_PRO_ONLY.color.includes(c.color) ? 'purple' : c.color) : c.patternColor,
    accColor: AVATAR_PRO_ONLY.color.includes(c.accColor) ? 'default' : c.accColor,
  };
}

/** A swatch by id (unknown → purple). */
export function avatarColor(id: string): AvatarColor {
  return AVATAR_COLORS.find((c) => c.id === id) ?? AVATAR_COLORS[0];
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
  return { v: 1, body: 'classic', color, pattern: 'solid', patternColor: color, eyes: 'beady', nose: 'none', cheeks: 'none', mouth: 'smile', head: 'none', face: 'none', neck: 'none', accColor: 'default', frame: 'none', bg: 'auto', display: 'mascot' };
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
