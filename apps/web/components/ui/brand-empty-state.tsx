import type { ReactNode } from 'react';
import { ArtScene } from '@/components/ui/art-scene';
import { Mascot } from '@/components/ui/mascot';
import { CandyButton, CandyLink, type CandyColor, type CandyIconName } from '@/components/ui/candy-button';
import { PAGE_TITLE_GRADIENTS, type PageAccent } from '@/components/ui/page-header';
import type { SceneName } from '@/lib/art';
import type { MascotId } from '@/lib/mascots';
import { HeadingArt, type HeadingSlug } from '@/components/ui/heading-art';

// FINISH_SPEC BI24: the one finished empty / error / not-found state. No generic
// icon, no bare spinner, no plain-text line, no bordered box: a cast host (its
// ART_SPEC §7 scene when one fits, else the host mascot), the title in the
// brand gradient caps, ONE short line in the app's voice, and a candy action
// when one makes sense. `preview` draws a dimmed glimpse of what will appear.
// Enters with the shared fade-up (transform / opacity only). No hooks, so it
// renders in server components too.

export interface BrandEmptyStateProps {
  title: string;
  line: string;
  scene?: SceneName;
  host?: MascotId;
  /** Art height in px (the scene, or ~0.8× for the bare host). */
  artHeight?: number;
  accent?: PageAccent;
  /** Candy action: a link (`actionHref`) or a button (`onAction`). */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  actionColor?: CandyColor;
  actionIcon?: CandyIconName;
  /** Anything under the action (a quieter second action). */
  secondary?: ReactNode;
  /** A dimmed preview of what will appear here. */
  preview?: ReactNode;
  /** FINISH_SPEC BJ16: the title as heading lettering (NOT FOUND, OOPS!, …); `title` stays its label. */
  heading?: HeadingSlug;
  /** Full-screen states (404, error) load the art eagerly. */
  priority?: boolean;
  className?: string;
}

export function BrandEmptyState({
  title, line, scene, host = 'w', artHeight = 120, accent = 'brand',
  actionLabel, actionHref, onAction, actionColor = 'purple', actionIcon,
  secondary, preview, priority = false, className = '', heading,
}: BrandEmptyStateProps) {
  return (
    <div className={`animate-fade-in-up flex flex-col items-center gap-2 text-center w-full px-6 py-4 ${className}`} role="status">
      {scene ? (
        <ArtScene scene={scene} height={artHeight} priority={priority} />
      ) : (
        <Mascot id={host} size={Math.round(artHeight * 0.8)} motion="bob" priority={priority} />
      )}
      {heading ? (
        <HeadingArt slug={heading} as="h2" label={title} height={40} className="mt-1" />
      ) : (
      <h2
        className="mt-1 text-xl font-black uppercase tracking-wide leading-tight"
        style={{ background: PAGE_TITLE_GRADIENTS[accent], WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
      >
        {title}
      </h2>
      )}
      <p className="text-sm font-bold max-w-xs" style={{ color: 'var(--color-text-muted)' }}>{line}</p>
      {actionLabel && actionHref && (
        <CandyLink href={actionHref} color={actionColor} size="md" icon={actionIcon} className="mt-2">{actionLabel}</CandyLink>
      )}
      {actionLabel && !actionHref && onAction && (
        <CandyButton color={actionColor} size="md" icon={actionIcon} className="mt-2" onClick={onAction}>{actionLabel}</CandyButton>
      )}
      {secondary}
      {preview && <div aria-hidden="true" className="w-full mt-2 pointer-events-none select-none" style={{ opacity: 0.38 }}>{preview}</div>}
    </div>
  );
}
