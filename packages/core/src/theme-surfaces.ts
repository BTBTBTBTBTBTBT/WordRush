// ============================================================
// Theme surfaces (FRIDAY-QUEUE item 25): the card / border / ink tokens a theme derives from its registry look.
// ============================================================
// theme-registry.json gives each theme a handful of colors (card, ink, inkSecondary, accent, tabBar, tiles); every
// other surface token (hover, raised, borders, divider, muted ink, the tab dock edge, key colors) is MIXED from those,
// so a theme is data, not a pile of hand-picked hexes. The Swift (ThemeSurfaces.swift) and Kotlin (ThemeSurfaces.kt)
// ports do the same math; theme-surfaces-fixtures.json pins the output of all three byte for byte.
// Season skins still win: they set their own surfaces on top (season-registry.json).

export interface SurfaceLookInput {
  card: string;
  ink: string;
  inkSecondary: string;
  accent: string;
  tabBar: string;
}

export interface ThemeSurfaces {
  surface: string;
  surfaceHover: string;
  surfaceAlt: string;
  border: string;
  borderAlt: string;
  borderLight: string;
  divider: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** The tab dock fill and its top edge. */
  tabBar: string;
  tabEdge: string;
}

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const to2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();

/** `a` toward `b` by `t` (0..1), per channel, rounded half up: "#RRGGBB". */
export function mixHex(a: string, b: string, t: number): string {
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return `#${to2(ar + (br - ar) * t)}${to2(ag + (bg - ag) * t)}${to2(ab + (bb - ab) * t)}`;
}

/** The surface tokens for one theme look. */
export function themeSurfaces(l: SurfaceLookInput): ThemeSurfaces {
  return {
    surface: l.card.toUpperCase(),
    surfaceHover: mixHex(l.card, l.accent, 0.08),
    surfaceAlt: mixHex(l.card, l.accent, 0.05),
    border: mixHex(l.card, l.accent, 0.24),
    borderAlt: mixHex(l.card, l.accent, 0.16),
    borderLight: mixHex(l.card, l.accent, 0.12),
    divider: mixHex(l.card, l.accent, 0.1),
    text: l.ink.toUpperCase(),
    textSecondary: l.inkSecondary.toUpperCase(),
    textMuted: mixHex(l.inkSecondary, l.card, 0.2),
    tabBar: l.tabBar.toUpperCase(),
    tabEdge: mixHex(l.tabBar, l.accent, 0.3),
  };
}
