'use client';

import { useFlags } from '@/hooks/use-flags';
import { SHARE_SHEET_FLAG } from '@/lib/share-sheet-web';

/**
 * share_sheet_v2: the custom share sheet. Needs the app_flags row to exist (isOn fails closed on a missing row, so
 * the sheet never reaches the public by accident), not be disabled (isLive, the off-switch), and match the audience
 * ('testers' = admins and testers until the founder approves, then 'all').
 */
export function useShareSheetFlag(): boolean {
  const { isLive, isOn } = useFlags();
  return isLive(SHARE_SHEET_FLAG) && isOn(SHARE_SHEET_FLAG);
}
