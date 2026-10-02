import { TrendingUp, Shield, Skull, Crown, Grid3x3, Shuffle, Hexagon, Quote, Group, KeyRound, TextSearch, Star } from 'lucide-react';
import { LadderIcon } from '@/components/ui/ladder-icon';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';
import { GameArt } from '@/components/ui/game-art';
import { GAME_ART_FILL } from '@/lib/art';
import { MODES } from '@/lib/modes.generated';

// Per-mode icon for the guide pages, mirroring the home grid + landing:
// real game icons everywhere, roman numerals for QuadWord/OctoWord.
type IconCmp = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
const ICONS: Record<string, IconCmp> = {
  classic: WordleGridIcon,
  six: SixIcon,
  seven: SevenIcon,
  succession: TrendingUp,
  deliverance: Shield,
  gauntlet: Skull,
  propernoundle: Crown,
  // More Games titles (same icons as the home chrome).
  sudocious: Grid3x3, muddle: Shuffle, hubbub: Hexagon, crosswordocious: Quote, kindred: Group,
  'letter-ladder': LadderIcon, codebreaker: KeyRound, spyglass: TextSearch, starsweep: Star,
};
const ROMAN: Record<string, string> = { quadword: 'IV', octoword: 'VIII' };

/** Guide slug → catalog mode id, for the game's 3D art. */
const MODE_ID_BY_SLUG: Record<string, string> = Object.fromEntries(
  MODES.filter((m) => m.guideSlug).map((m) => [m.guideSlug as string, m.id]),
);

/** Tailwind w-* → px (w-4 → 16), for sizing the art to the old glyph's slot. */
function slotPx(className: string): number {
  const m = className.match(/(?:^|\s)w-(\d+(?:\.\d+)?)(?=\s|$)/);
  return m ? Number(m[1]) * 4 : 16;
}

/** The game's 3D art (docs/ART_SPEC.md §3) filling the chip; the old glyph is the fallback. */
export function GuideIcon({ slug, accent, className = 'w-4 h-4' }: { slug: string; accent: string; className?: string }) {
  const id = MODE_ID_BY_SLUG[slug];
  const old = <OldGuideIcon slug={slug} accent={accent} className={className} />;
  return id ? <GameArt id={id} size={slotPx(className) * GAME_ART_FILL} fallback={old} /> : old;
}

function OldGuideIcon({ slug, accent, className }: { slug: string; accent: string; className: string }) {
  if (ROMAN[slug]) {
    return <span className="text-[11px] font-black leading-none" style={{ color: accent }}>{ROMAN[slug]}</span>;
  }
  const Icon = ICONS[slug];
  return Icon ? <Icon className={className} style={{ color: accent }} />
    : <span className="text-[11px] font-black" style={{ color: accent }}>{slug.charAt(0).toUpperCase()}</span>;
}
