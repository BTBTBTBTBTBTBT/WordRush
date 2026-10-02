import { GAME_TILES_OPACITY, PAGE_TILES, PAGE_TINTS, accentCardShadow, artSrc, gameTintForDbKey, type PageTint, type TintStops } from '@/lib/art';

// "Page tint + tiles" (docs/ART_SPEC.md §11, founder pick 2026-10-02): the one
// shared page background. It is the page's root element: a soft diagonal
// gradient in the page's tint with the letter-tile pattern on top, both in a
// fixed layer behind everything (edge to edge, under the header and the status
// bar; the bottom tab bar keeps its own surface). It also hands its cards the
// tinted shadow (`--page-card-shadow`, read through lib/art.ts onPageShadow).
//
// Tints: home (Home, Settings, Pro, Help/Guides, profile, the default),
// leaderboard (Leaderboard, Records), stats, friends, vs (VS pages).
// Dark mode follows the site's [data-theme="dark"] like every other surface;
// pages whose cards are drawn light-only (Friends, VS) pass scheme="light" so
// their gray labels never sit on a dark tint. Reduce transparency / more
// contrast drops the tiles and keeps the gradient (globals.css .page-bg).
// No hooks, so server pages can use it too.
//
// §15: solo game screens pass their own `colors` (lib/art.ts gameTint, made
// from the game's accent) and the quieter `tilesOpacity` (GAME_TILES_OPACITY);
// boards, keyboards and tiles draw their own opaque colors on top.

interface PageBackgroundProps {
  tint?: PageTint;
  /** 'light' pins the light stops even in the dark theme (light-only pages). */
  scheme?: 'auto' | 'light';
  /** Custom stops + accent instead of a named tint (§15 game screens). */
  colors?: TintStops;
  /** Tile pattern opacity instead of the menus' 100% / 60% (§15 + §18.1 game screens: 55% / 35%). */
  tilesOpacity?: { light: number; dark: number };
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}

export function PageBackground({
  tint = 'home', scheme = 'auto', colors, tilesOpacity = PAGE_TILES.opacity, className = '', style, children,
}: PageBackgroundProps) {
  const { light, dark, accent } = colors ?? PAGE_TINTS[tint];
  const vars = {
    '--page-bg-1': light[0],
    '--page-bg-2': light[1],
    '--page-bg-3': light[2],
    '--page-bg-dark-1': dark[0],
    '--page-bg-dark-2': dark[1],
    '--page-bg-dark-3': dark[2],
    '--page-tiles': `url('${artSrc(PAGE_TILES.name)}')`,
    '--page-tiles-size': `${PAGE_TILES.size}px`,
    '--page-tiles-opacity': String(tilesOpacity.light),
    '--page-tiles-opacity-dark': String(tilesOpacity.dark),
    '--page-card-shadow': accentCardShadow(accent),
  } as React.CSSProperties;
  return (
    <div className={className} style={{ ...vars, ...style }} data-page-tint={colors ? 'game' : tint} data-page-scheme={scheme}>
      <div className="page-bg" aria-hidden="true" />
      {children}
    </div>
  );
}

/**
 * A solo game screen's background (docs/ART_SPEC.md §15): PageBackground in
 * the game's own tint (gameTint of its accent) with the quieter tile pattern,
 * cards' shadows leaning toward the accent. Not for VS matches. The game's
 * root element: it takes the className / style the old flat-background div had.
 */
export function GameBackground({ mode, ...rest }: Omit<PageBackgroundProps, 'tint' | 'colors' | 'tilesOpacity'> & {
  /** The mode's db key (DUEL, QUORDLE, SCRAMBLE, …). */
  mode: string;
}) {
  return <PageBackground colors={gameTintForDbKey(mode) ?? undefined} tilesOpacity={GAME_TILES_OPACITY} {...rest} />;
}
