// Footer / info page accents (docs/FINISH_SPEC.md C6): cards without a game of
// their own rotate through these so a long page never reads as one flat color.

/** The intro card's top bar (purple → pink). */
export const INTRO_BAR = 'linear-gradient(90deg, #7c3aed, #ec4899)';

/** Card accents the info pages rotate through (brand purple, pink, orange, teal, blue). */
export const INFO_ACCENTS = ['#7c3aed', '#ec4899', '#f97316', '#0d9488', '#3b82f6'] as const;

/** The i-th rotating info accent (wraps; negative / fractional indexes map to a whole index). */
export function infoAccent(i: number): string {
  const n = INFO_ACCENTS.length;
  if (!Number.isFinite(i)) return INFO_ACCENTS[0];
  return INFO_ACCENTS[Math.floor(Math.abs(i)) % n];
}

/** Where the help icon on an info page leads: How to Play, except on How to Play itself (→ FAQ). */
export function infoHelpTarget(pathname: string | null | undefined): { href: string; label: string } {
  const p = (pathname ?? '').replace(/\/+$/, '');
  return p === '/how-to-play' ? { href: '/faq', label: 'FAQ' } : { href: '/how-to-play', label: 'How to play' };
}
