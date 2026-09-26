'use client';

import {
  TrendingUp, Swords, Skull, Shield, Crown, LayoutGrid, Grid3x3, Shuffle, Hexagon, Quote,
  Group, KeyRound, TextSearch, Star,
} from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { LadderIcon } from '@/components/ui/ladder-icon';
import { CORE_MODES, MORE_GAME_MODES, type ModeMeta } from '@/lib/modes.generated';
import { MODE_ROUTES } from '@/lib/mode-routes';

export type ModeIcon = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

// Per-mode icon + route chrome (web-native; not centralizable). Title/desc/
// accent/romanNumeral come from the single-source catalog (modes.generated).
// Extracted from app/page.tsx (More Games Stage 5) so the home grid and the
// More Games sheet build their cards from ONE table. The More Games titles
// have their chrome here already so a game cannot land without an icon.
export const MODE_CHROME: Record<string, { icon: ModeIcon | null; href: string; vsHref: string }> = {
  practice: { icon: WordleGridIcon, href: '/practice?daily=true', vsHref: '/practice/vs' },
  vs: { icon: Swords, href: '/practice/vs?daily=true', vsHref: '/practice/vs?daily=true' },   // daily toggle → shared daily VS
  quordle: { icon: null, href: '/quadword?daily=true', vsHref: '/quadword/vs' },
  octordle: { icon: null, href: '/octoword?daily=true', vsHref: '/octoword/vs' },
  sequence: { icon: TrendingUp, href: '/sequence?daily=true', vsHref: '/sequence/vs' },
  rescue: { icon: Shield, href: '/rescue?daily=true', vsHref: '/rescue/vs' },
  six: { icon: SixIcon, href: '/six?daily=true', vsHref: '/six/vs' },
  seven: { icon: SevenIcon, href: '/seven?daily=true', vsHref: '/seven/vs' },
  gauntlet: { icon: Skull, href: '/gauntlet?daily=true', vsHref: '/gauntlet/vs' },
  propernoundle: { icon: Crown, href: '/propernoundle?daily=true', vsHref: '/propernoundle/vs' },
  // The More Games tile itself: no route — it opens the sheet (/?more=1).
  more: { icon: LayoutGrid, href: '/?more=1', vsHref: '/?more=1' },
  sudoku: { icon: Grid3x3, href: `${MODE_ROUTES.SUDOKU}?daily=true`, vsHref: MODE_ROUTES.SUDOKU },
  scramble: { icon: Shuffle, href: `${MODE_ROUTES.SCRAMBLE}?daily=true`, vsHref: MODE_ROUTES.SCRAMBLE },
  hub: { icon: Hexagon, href: `${MODE_ROUTES.HUB}?daily=true`, vsHref: MODE_ROUTES.HUB },
  crossword: { icon: Quote, href: `${MODE_ROUTES.CROSSWORD}?daily=true`, vsHref: MODE_ROUTES.CROSSWORD },
  groups: { icon: Group, href: `${MODE_ROUTES.GROUPS}?daily=true`, vsHref: MODE_ROUTES.GROUPS },
  ladder: { icon: LadderIcon, href: `${MODE_ROUTES.LADDER}?daily=true`, vsHref: MODE_ROUTES.LADDER },
  cryptogram: { icon: KeyRound, href: `${MODE_ROUTES.CRYPTOGRAM}?daily=true`, vsHref: MODE_ROUTES.CRYPTOGRAM },
  wordsearch: { icon: TextSearch, href: `${MODE_ROUTES.WORDSEARCH}?daily=true`, vsHref: MODE_ROUTES.WORDSEARCH },
  regions: { icon: Star, href: `${MODE_ROUTES.REGIONS}?daily=true`, vsHref: MODE_ROUTES.REGIONS },
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
