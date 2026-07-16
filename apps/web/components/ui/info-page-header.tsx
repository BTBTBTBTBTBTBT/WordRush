'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X, ChevronLeft } from 'lucide-react';

/**
 * Native MenuScaffold parity chrome for the site-nav info pages (the pages
 * the header "?" menu opens): the 6px purple→pink→amber accent bar, the
 * uppercase gradient title on the left, and a circular X on the right that
 * closes the page — history back when there is one, else home. Replaces the
 * old "← Back to Wordocious" link above the title. Sub-pages (guide/strategy
 * articles) pass `backHref` for the leading chevron, mirroring the native
 * scaffold's onBack.
 */
export function InfoPageHeader({ title, backHref, titleTag = 'h1' }: {
  title: string;
  backHref?: string;
  /** 'div' on article detail pages, whose real h1 is the article title in the body. */
  titleTag?: 'h1' | 'div';
}) {
  const router = useRouter();
  const TitleTag = titleTag;
  const close = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/');
  };
  return (
    <>
      <div className="h-1.5 w-full" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #fbbf24)' }} />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2 flex items-center gap-2.5">
        {backHref && (
          <Link href={backHref} aria-label="Back" className="flex-shrink-0" style={{ color: 'var(--color-text-muted)' }}>
            <ChevronLeft className="w-5 h-5" strokeWidth={3} />
          </Link>
        )}
        <TitleTag
          className="text-2xl font-black uppercase leading-tight min-w-0 truncate text-transparent bg-clip-text"
          style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #ec4899)' }}
        >
          {title}
        </TitleTag>
        <button
          onClick={close}
          aria-label="Close"
          className="ml-auto flex-shrink-0 flex items-center justify-center w-[30px] h-[30px] rounded-full transition-opacity hover:opacity-80"
          style={{ background: 'var(--color-surface-alt)', color: 'var(--color-text-muted)' }}
        >
          <X className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>
    </>
  );
}
