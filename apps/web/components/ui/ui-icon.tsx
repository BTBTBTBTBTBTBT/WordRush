import type { CSSProperties } from 'react';
import { Icon3D, type Icon3DName } from '@/components/ui/icon3d';
import { BadgeArt } from '@/components/badges/badge-art';
import { MedalArt } from '@/components/stats/medal-art';
import type { BadgeName, Medal } from '@/lib/art';

// The art that stands where a phone emoji used to (FINISH_SPEC AL addendum 2 +
// AM3, founder 10-02: "No phone emojis anywhere on the app"). One name → our 3D
// art: streak = Icon3D flame, solved = Icon3D badge-check, points = the gold
// star sprite, speed / time = the gold zap sprite, medals = the medal art, plus
// the achievement badges (target, swords, sparkles …). Decorative unless given a
// label. No hooks, so it renders in server components too. The scan test
// scripts/no-emoji-ui.test.ts keeps emoji from creeping back into the UI.

export type UiIconName =
  | Icon3DName
  | 'check'
  | 'star'
  | 'zap'
  | 'medal-gold'
  | 'medal-silver'
  | 'medal-bronze'
  | 'medal'
  | 'pro-crown'
  | 'target'
  | 'swords'
  | 'sparkles'
  | 'grid'
  | 'calendar'
  | 'trending-up'
  | 'group';

const BADGE: Partial<Record<UiIconName, BadgeName>> = {
  star: 'icon-star-sprite',
  zap: 'icon-zap-sprite',
  medal: 'medal',
  'pro-crown': 'pro-crown-sprite',
  target: 'target',
  swords: 'swords',
  sparkles: 'sparkles',
  grid: 'grid',
  calendar: 'calendar',
  'trending-up': 'trending-up',
  group: 'group',
};

const MEDAL: Partial<Record<UiIconName, Medal>> = {
  'medal-gold': 'gold',
  'medal-silver': 'silver',
  'medal-bronze': 'bronze',
};

/** gold / silver / bronze → its medal icon name; anything else → the generic medal badge. */
export function medalIconName(medal: string): UiIconName {
  return medal === 'gold' || medal === 'silver' || medal === 'bronze' ? `medal-${medal}` : 'medal';
}

export function UiIcon({ name, size = 18, label, inline = false, className = '', style }: {
  name: UiIconName;
  size?: number;
  label?: string;
  /** Sits on the text baseline inside a line of copy. */
  inline?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const inlineStyle: CSSProperties | null = inline ? { display: 'inline-block', verticalAlign: '-0.18em' } : null;
  const medal = MEDAL[name];
  if (medal) {
    const art = <MedalArt medal={medal} size={size} inline={inline} className={className} style={style} />;
    return label ? <span role="img" aria-label={label} className="inline-flex shrink-0">{art}</span> : art;
  }
  const badge = BADGE[name];
  if (badge) return <BadgeArt name={badge} size={size} label={label} className={className} style={{ ...inlineStyle, ...style }} />;
  const icon: Icon3DName = name === 'check' ? 'badge-check' : (name as Icon3DName);
  return <Icon3D name={icon} size={size} label={label} inline={inline} className={className} style={style} />;
}
