'use client';

import { HOME_ROOT, claimHomeTap, closeAllOverlays } from '@/lib/nav-home';
import { usePathname, useRouter } from 'next/navigation';
import { HeaderGlyph } from '@/components/ui/header-glyph';
import { Mascot } from '@/components/ui/mascot';
import { FOOTER_TITLE_HEIGHT, PageHeadline } from '@/components/ui/page-headline';
import { PAGE_TITLE_GRADIENTS } from '@/components/ui/page-header';
import { infoHelpTarget } from '@/lib/info-page';
import type { ArtName } from '@/lib/art';
import type { MascotId } from '@/lib/mascots';

/**
 * The footer / info page header (docs/FINISH_SPEC.md C6, A3, A6; mockup
 * finishing-touches.html, the Guides phone): a controls row with the bare 3D
 * back icon on the left and the help icon on the right (44 px taps, squish on
 * press), then the page's own title art as a full-width headline — every
 * footer page at the one shared height (FOOTER_TITLE_HEIGHT). Replaces the old
 * 6 px gradient bar + X close.
 *
 * Back keeps the old close behavior: history back when there is one, else
 * home. Sub-pages (guide / strategy articles) pass `backHref`, which the back
 * icon links to (the old leading chevron). Help → How to Play (→ FAQ on How to
 * Play itself), or `help` to override / `help={false}` to hide.
 * Pages without title art (Delete Account, About, Support) get the caps
 * gradient text title, with their host beside it when given.
 */
export interface InfoPageHeaderProps {
  title: string;
  /** The page's title art as the headline (A6), in place of the text title. */
  art?: ArtName;
  /** The art's accessible name (the lettering's text); defaults to `title`. */
  artLabel?: string;
  backHref?: string;
  /** Text-title pages only: the page's host (docs/MASCOT_SPEC.md §6) beside the title. */
  host?: MascotId;
  /** 'div' on article detail pages, whose real h1 is the article title in the body. */
  titleTag?: 'h1' | 'div';
  /** The help icon's target; false hides it. */
  help?: { href: string; label: string } | false;
}

export function InfoPageHeader({ title, backHref, titleTag = 'h1', host, art, artLabel, help }: InfoPageHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  // AY: the top-left button lands on the Home root — never history-back, which
  // could reveal a game this page was opened from.
  const close = () => {
    if (!claimHomeTap()) return;
    closeAllOverlays();
    router.push(HOME_ROOT);
  };
  const helpTarget = help === false ? null : help ?? infoHelpTarget(pathname);
  const TitleTag = titleTag;
  return (
    <div className="max-w-2xl mx-auto px-4 pt-3">
      <div className="flex items-center justify-between" style={{ minHeight: 44 }}>
        {backHref
          ? <HeaderGlyph icon="back" href={backHref} label="Back" />
          : <HeaderGlyph icon="back" onClick={close} label="Back" />}
        {helpTarget && <HeaderGlyph icon="help" href={helpTarget.href} label={helpTarget.label} />}
      </div>
      {art ? (
        <PageHeadline name={art} label={artLabel ?? title} as={titleTag} maxHeight={FOOTER_TITLE_HEIGHT} className="mt-1 mb-2" />
      ) : (
        <div className="flex items-center justify-center gap-2 mt-1 mb-3">
          {host && <Mascot id={host} size={44} motion="bob" priority />}
          <TitleTag
            className="m-0 font-black uppercase leading-tight text-center text-transparent bg-clip-text"
            style={{ fontSize: 28, letterSpacing: 0.4, backgroundImage: PAGE_TITLE_GRADIENTS.brand }}
          >
            {title}
          </TitleTag>
        </div>
      )}
    </div>
  );
}
