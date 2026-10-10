import type { CSSProperties, ReactNode } from 'react';
import { ArtScene } from '@/components/ui/art-scene';
import { BubbleText } from '@/components/ui/bubble-text';
import { CastHeader } from '@/components/ui/cast-header';
import { HeadingArt, type HeadingSlug } from '@/components/ui/heading-art';
import { PageBackground } from '@/components/ui/page-background';
import { PoseArt, StateCard, POPUP_ACCENT, softNotice } from '@/components/ui/soft-popup';
import type { PageTint, PoseArtName, SceneName } from '@/lib/art';

// 2.8 utility pages (founder 10-09: "Any other pages like this need to be updated to the new aesthetic, these look
// historic"): the ONE shell for every standalone utility screen (password reset, email confirm, 404, error, invite
// fallbacks, the admin session relay). The page wall (PageBackground draws the season's night wall in season, the
// normal wall otherwise), the live WORDOCIOUS cast row on top exactly as on Home, then one soft card that hugs its
// content: an existing cast pose / scene, the title in the house lettering, one calm line in the theme inks, a soft
// notice and the family buttons. Everything readable sits ON the card, so the season / dark inks never fight the wall.
// No hooks, so server pages can use it.

/** The full-screen shell: wall + cast row + a column that centers its card and scrolls on a short screen. */
export function UtilityPage({ children, tint = 'home', className = '' }: { children: ReactNode; tint?: PageTint; className?: string }) {
  return (
    <PageBackground tint={tint} className={`fixed inset-0 overflow-y-auto ${className}`}>
      <div className="w-full max-w-sm mx-auto flex flex-col items-center gap-3 px-5 pt-3 pb-8" style={{ minHeight: '100%' }}>
        <div className="w-full"><CastHeader ground /></div>
        <div className="w-full flex-1 flex flex-col justify-center">{children}</div>
      </div>
    </PageBackground>
  );
}

/**
 * The card inside the shell. Art: a pose (a different character than the cast row's hosts) or a scene. Title: the
 * page's heading lettering when one exists (`heading`), else the title in the bubble lettering. `busy` announces a
 * loading state politely. `notice` is the app's soft notice (never a raw pink box). `children` = the actions / form.
 */
export function UtilityCard({
  pose, scene, artSize = 104, heading, title, line, notice, busy = false, accent = POPUP_ACCENT.brand, priority = false, children,
}: {
  pose?: PoseArtName;
  scene?: SceneName;
  /** Pose size (px) or the scene's height. */
  artSize?: number;
  heading?: HeadingSlug;
  /** The title's words (the heading art's accessible name when `heading` is set). */
  title: string;
  line?: ReactNode;
  notice?: { kind: 'error' | 'success' | 'info'; text: ReactNode };
  busy?: boolean;
  accent?: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  return (
    <StateCard accent={accent} className="animate-fade-in-up">
      <div className="flex flex-col items-center gap-2" role={busy ? 'status' : undefined} aria-live={busy ? 'polite' : undefined}>
        {scene ? <ArtScene scene={scene} height={artSize} priority={priority} /> : pose ? <PoseArt pose={pose} size={artSize} priority={priority} /> : null}
        {heading ? (
          <HeadingArt slug={heading} as="h1" label={title} height={40} className="mt-1" />
        ) : (
          <h1 className="m-0 mt-1 w-full">
            <BubbleText text={title.toUpperCase()} palette="home" maxSize={30} minSize={18} level={1} />
          </h1>
        )}
        {line != null && (
          <p className="m-0 text-sm font-bold leading-snug max-w-xs" style={{ color: 'var(--color-text-secondary)' }}>{line}</p>
        )}
        {notice && (
          <div className="w-full p-3 text-xs font-bold text-left" role={notice.kind === 'error' ? 'alert' : 'status'} style={softNotice(notice.kind)}>
            {notice.text}
          </div>
        )}
      </div>
      {children != null && <div className="w-full mt-4 text-left">{children}</div>}
    </StateCard>
  );
}

/** A form label in the theme ink (the reset form's fields). */
export const FIELD_LABEL: CSSProperties = { color: 'var(--color-text-secondary)' };
