import Image from 'next/image';
import type { CSSProperties } from 'react';
import { SoftNum } from '@/components/ui/soft-number';
import { ART_SIZE, artSrc, badgeSrc, type BadgeName } from '@/lib/art';
import { levelBadge, levelLabel } from '@/lib/badges';

// The 3D badges (docs/FINISH_SPEC.md V): the badge art itself, the level badge
// (the tier badge + the level number in soft numbers) and the small Pro member
// mark that sits next to a Pro player's name. No hooks: renders anywhere.

/** One 3D badge image. Decorative unless it gets a `label`. */
export function BadgeArt({ name, size, label, priority = false, className = '', style }: {
  name: BadgeName;
  size: number;
  label?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <Image
      src={badgeSrc(name)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      className={`block shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}

/** The achievement's own badge art name (FINISH_SPEC BD / night art 10-03), or null if it hasn't shipped. */
export function achievementArtName(key: string): string | null {
  const name = `art-ach-${key}`;
  return name in (ART_SIZE as Record<string, unknown>) ? name : null;
}

/**
 * An achievement's badge: its own `art-ach-<key>` (BD, all 117 shipped 10-03) when it exists,
 * else the category / icon badge (`fallback`). Same box either way, so no layout change; iOS
 * BadgeArt.achievementAsset + Android AchievementBadge parity.
 */
export function AchievementArt({ achKey, fallback, size, label, priority = false, className = '', style }: {
  achKey: string;
  fallback: BadgeName;
  size: number;
  label?: string;
  priority?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const own = achievementArtName(achKey);
  if (!own) return <BadgeArt name={fallback} size={size} label={label} priority={priority} className={className} style={style} />;
  return (
    <Image
      src={artSrc(own)}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      width={size}
      height={size}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
      draggable={false}
      className={`block shrink-0 select-none pointer-events-none ${className}`}
      style={{ width: size, height: size, objectFit: 'contain', ...style }}
    />
  );
}

/**
 * V3: the level badge — the tier badge (16–64 px by context) with the level
 * number in soft numbers beside it; `tier` adds the tier name ("GOLD"). The
 * whole thing reads as "Level 26 · Gold" to screen readers.
 */
export function LevelBadge({ level, size = 20, numberSize, prefix, tier = false, numberClassName = 'soft-num-auto', className = '', style }: {
  level: number;
  size?: number;
  numberSize?: number;
  /** Small text before the number ("LVL"). */
  prefix?: string;
  /** Show the tier name after the number. */
  tier?: boolean;
  numberClassName?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const lvl = Math.max(1, Math.floor(level || 1));
  const label = levelLabel(lvl);
  const n = numberSize ?? Math.max(11, Math.round(size * 0.62));
  return (
    <span className={`inline-flex items-center shrink-0 ${className}`} style={{ gap: Math.max(2, Math.round(size * 0.14)), ...style }}>
      <span className="sr-only">{label}</span>
      <BadgeArt name={levelBadge(lvl)} size={size} />
      <span aria-hidden="true" className="inline-flex items-baseline" style={{ gap: 3 }}>
        {prefix && <span className="font-black uppercase" style={{ fontSize: Math.max(9, Math.round(n * 0.62)), letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>{prefix}</span>}
        <SoftNum size={n} className={numberClassName}>{lvl}</SoftNum>
        {tier && (
          <span className="font-black uppercase" style={{ fontSize: Math.max(9, Math.round(n * 0.62)), letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>
            {label.split(' · ')[1]}
          </span>
        )}
      </span>
    </span>
  );
}

/** V3 / AA: the small Pro member mark (crown on a purple gem) next to a Pro player's name. */
export function ProMark({ size = 20, className = '', style }: { size?: number; className?: string; style?: CSSProperties }) {
  return <BadgeArt name="level-pro" size={size} label="Pro member" className={className} style={style} />;
}
