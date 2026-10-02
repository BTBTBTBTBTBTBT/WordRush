/**
 * ProperNoundle theme-category display metadata — labels and accents (no
 * emoji: FINISH_SPEC AM3 — the words carry the category)
 * keyed by the raw themeCategory slug ('currentevents' → 'Current Events').
 * Shared by the solo game, the VS match header pill, and the recap so no
 * surface ever shows the raw slug.
 */
export const CATEGORY_LABELS: Record<string, string> = {
  music: 'Music',
  videogames: 'Video Games',
  movies: 'Movies & TV',
  sports: 'Sports',
  history: 'History',
  science: 'Science',
  currentevents: 'Current Events',
};

export const CATEGORY_COLORS: Record<string, string> = {
  music: '#ec4899',
  videogames: '#8b5cf6',
  movies: '#f59e0b',
  sports: '#10b981',
  history: '#6366f1',
  science: '#06b6d4',
  currentevents: '#ef4444',
};

/** Pretty label for a slug — falls back to the slug so unknown categories degrade visibly, not blank. */
export function categoryLabel(slug: string | undefined | null): string {
  if (!slug) return '';
  return CATEGORY_LABELS[slug] || slug;
}
