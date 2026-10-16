'use client';

import { useFlags } from '@/hooks/use-flags';
import { HOME_HEADLINES_FLAG } from '@/lib/home-headline-pool-web';

/**
 * home_headlines_v2: the Home headline pool. Same gate as the share sheet: the app_flags row must exist (isOn fails
 * closed on a missing row, so the pool never reaches the public by accident), not be disabled (isLive, the
 * off-switch), and match the audience ('testers' = admins and testers until the founder approves, then 'all').
 */
export function useHomeHeadlinesFlag(): boolean {
  const { isLive, isOn } = useFlags();
  return isLive(HOME_HEADLINES_FLAG) && isOn(HOME_HEADLINES_FLAG);
}
