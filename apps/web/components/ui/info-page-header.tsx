'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/ui/page-header';
import type { MascotId } from '@/lib/mascots';

/**
 * Native MenuScaffold parity chrome for the site-nav info pages (the pages
 * the header "?" menu opens): the 6px purple→pink→amber accent bar, the
 * uppercase gradient title on the left, and a circular X on the right that
 * closes the page — history back when there is one, else home. Replaces the
 * old "← Back to Wordocious" link above the title. Sub-pages (guide/strategy
 * articles) pass `backHref` for the leading chevron, mirroring the native
 * scaffold's onBack. Built on the shared PageHeader (HEADER_SPEC §4).
 */
export function InfoPageHeader({ title, backHref, titleTag = 'h1', host }: {
  title: string;
  backHref?: string;
  /** The page's host (docs/MASCOT_SPEC.md §6), standing beside the title. */
  host?: MascotId;
  /** 'div' on article detail pages, whose real h1 is the article title in the body. */
  titleTag?: 'h1' | 'div';
}) {
  const router = useRouter();
  const close = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };
  return (
    <>
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />
      {/* HEADER_SPEC §4: the shared page header (white back/close circles, gradient caps title, host). */}
      <PageHeader
        className="max-w-2xl mx-auto px-4 pt-4 pb-2"
        title={title}
        titleTag={titleTag}
        titleSize={24}
        host={host}
        hostSize={44}
        back={backHref ? { href: backHref } : undefined}
        close={{ onClick: close }}
      />
    </>
  );
}
