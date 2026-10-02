'use client';

import {
  TrendingUp, Swords, Skull, Shield, Crown, LayoutGrid, Grid3x3, Shuffle, Hexagon, Quote,
  Group, KeyRound, TextSearch, Star,
} from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { LadderIcon } from '@/components/ui/ladder-icon';
import { CORE_MODES, MODES, MORE_GAME_MODES, type ModeMeta } from '@/lib/modes.generated';
import { MODE_ROUTES } from '@/lib/mode-routes';
import { gameArtIcon, type GameArtIconProps } from '@/components/ui/game-art';

export type ModeIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

// Per-mode icon + route chrome (web-native; not centralizable). Title/desc/
// accent/romanNumeral come from the single-source catalog (modes.generated).
// Extracted from app/page.tsx (More Games Stage 5) so the home grid and the
// More Games sheet build their cards from ONE table. The More Games titles
// have their chrome here already so a game cannot land without an icon.
//
// Art pass (docs/ART_SPEC.md §3): every `icon` draws the game's glossy 3D icon
// (public/art/game-<id>.webp) through gameArtIcon; the old glyph (lucide icon,
// custom icon, or the roman numeral for QuadWord / OctoWord) is the fallback
// when the art is missing. QuadWord / OctoWord now have an icon, so places that
// drew `romanNumeral` first check the icon first.

/** The old roman-numeral glyph (QuadWord IV, OctoWord VIII) as an icon, for the fallback. */
function numeralGlyph(id: string): React.ComponentType<GameArtIconProps> {
  const numeral = MODES.find((m) => m.id === id)?.romanNumeral ?? '';
  function NumeralGlyph({ style }: GameArtIconProps) {
    const size = typeof style?.width === 'number' ? style.width : 16;
    return <span className="font-black leading-none" style={{ color: style?.color, fontSize: Math.round(size * (numeral.length > 2 ? 0.55 : 0.69)) }}>{numeral}</span>;
  }
  return NumeralGlyph;
}

const art = gameArtIcon;

export const MODE_CHROME: Record<string, { icon: ModeIcon | null; href: string; vsHref: string }> = {
  practice: { icon: art('practice', WordleGridIcon), href: '/practice?daily=true', vsHref: '/practice/vs' },
  vs: { icon: art('vs', Swords), href: '/practice/vs?daily=true', vsHref: '/practice/vs?daily=true' },   // daily toggle → shared daily VS
  quordle: { icon: art('quordle', numeralGlyph('quordle')), href: '/quadword?daily=true', vsHref: '/quadword/vs' },
  octordle: { icon: art('octordle', numeralGlyph('octordle')), href: '/octoword?daily=true', vsHref: '/octoword/vs' },
  sequence: { icon: art('sequence', TrendingUp), href: '/sequence?daily=true', vsHref: '/sequence/vs' },
  rescue: { icon: art('rescue', Shield), href: '/rescue?daily=true', vsHref: '/rescue/vs' },
  six: { icon: art('six', SixIcon), href: '/six?daily=true', vsHref: '/six/vs' },
  seven: { icon: art('seven', SevenIcon), href: '/seven?daily=true', vsHref: '/seven/vs' },
  gauntlet: { icon: art('gauntlet', Skull), href: '/gauntlet?daily=true', vsHref: '/gauntlet/vs' },
  propernoundle: { icon: art('propernoundle', Crown), href: '/propernoundle?daily=true', vsHref: '/propernoundle/vs' },
  // The More Games tile itself: no route — it opens the sheet (/?more=1).
  more: { icon: art('more', LayoutGrid), href: '/?more=1', vsHref: '/?more=1' },
  sudoku: { icon: art('sudoku', Grid3x3), href: `${MODE_ROUTES.SUDOKU}?daily=true`, vsHref: MODE_ROUTES.SUDOKU },
  scramble: { icon: art('scramble', Shuffle), href: `${MODE_ROUTES.SCRAMBLE}?daily=true`, vsHref: MODE_ROUTES.SCRAMBLE },
  hub: { icon: art('hub', Hexagon), href: `${MODE_ROUTES.HUB}?daily=true`, vsHref: MODE_ROUTES.HUB },
  crossword: { icon: art('crossword', Quote), href: `${MODE_ROUTES.CROSSWORD}?daily=true`, vsHref: MODE_ROUTES.CROSSWORD },
  groups: { icon: art('groups', Group), href: `${MODE_ROUTES.GROUPS}?daily=true`, vsHref: MODE_ROUTES.GROUPS },
  ladder: { icon: art('ladder', LadderIcon), href: `${MODE_ROUTES.LADDER}?daily=true`, vsHref: MODE_ROUTES.LADDER },
  cryptogram: { icon: art('cryptogram', KeyRound), href: `${MODE_ROUTES.CRYPTOGRAM}?daily=true`, vsHref: MODE_ROUTES.CRYPTOGRAM },
  wordsearch: { icon: art('wordsearch', TextSearch), href: `${MODE_ROUTES.WORDSEARCH}?daily=true`, vsHref: MODE_ROUTES.WORDSEARCH },
  regions: { icon: art('regions', Star), href: `${MODE_ROUTES.REGIONS}?daily=true`, vsHref: MODE_ROUTES.REGIONS },
};

/** One card's worth of chrome + catalog data — what the grid and the sheet render. */
export interface HomeCard {
  id: string;
  dbKey: string | null;
  title: string;
  icon: ModeIcon | null;
  romanNumeral?: string;
  desc: string;
  accentColor: string;
  href: string;
  vsHref: string;
  guessSemantics: string;
  guessBase: number;
  dailyEligible: boolean;
  category: string | null;
  /** Remote gate (app_flags key); null = never gated. Filter lists with useFlags().isOn. */
  flagKey: string | null;
  /** Full-width tile under the grid (More Games band, VS Battle live tile), not a grid cell. */
  homeWide: boolean;
}

export function buildHomeCard(m: ModeMeta): HomeCard {
  return {
    id: m.id,
    dbKey: m.dbKey,
    title: m.title,
    icon: MODE_CHROME[m.id]?.icon ?? null,
    romanNumeral: m.romanNumeral ?? undefined,
    desc: m.desc,
    accentColor: m.accentHex,
    href: MODE_CHROME[m.id]?.href ?? '/',
    vsHref: MODE_CHROME[m.id]?.vsHref ?? '/',
    guessSemantics: m.guessSemantics,
    guessBase: m.guessBase,
    dailyEligible: m.dailyEligible,
    category: m.category,
    flagKey: m.flagKey,
    homeWide: m.homeWide,
  };
}

/** The home grid — every enabled core tile, catalog order. */
export const MODE_CARDS: HomeCard[] = CORE_MODES.map(buildHomeCard);
/** The More Games sheet — every enabled More Games title, catalog order. */
export const MORE_CARDS: HomeCard[] = MORE_GAME_MODES.map(buildHomeCard);
