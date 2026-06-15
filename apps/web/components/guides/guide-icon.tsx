import { TrendingUp, Shield, Skull, Crown } from 'lucide-react';
import { WordleGridIcon } from '@/components/ui/wordle-grid-icon';
import { SixIcon } from '@/components/ui/six-icon';
import { SevenIcon } from '@/components/ui/seven-icon';

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
};
const ROMAN: Record<string, string> = { quadword: 'IV', octoword: 'VIII' };

export function GuideIcon({ slug, accent, className = 'w-4 h-4' }: { slug: string; accent: string; className?: string }) {
  if (ROMAN[slug]) {
    return <span className="text-[11px] font-black leading-none" style={{ color: accent }}>{ROMAN[slug]}</span>;
  }
  const Icon = ICONS[slug];
  return Icon ? <Icon className={className} style={{ color: accent }} />
    : <span className="text-[11px] font-black" style={{ color: accent }}>{slug.charAt(0).toUpperCase()}</span>;
}
