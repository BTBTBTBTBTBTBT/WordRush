// Referral CREDIT notices on the "Gift a week of Pro" card (founder 10-03: "I need to be able to X
// that so it goes away"): the inviter's settled rows ("<name> joined! +3 days", "<name>
// subscribed! +1 free month") each get a dismiss X, plus a quiet "Clear all" at 2+. A dismissal
// sticks across relaunches (a per-user local list keyed by the referral id, the immediate
// fallback) and across devices (the server flag referrals.inviter_dismissed_at via
// /api/referrals/dismiss, docs/sql/20261003-referral-credit-dismiss.sql). Mirrors iOS
// ReferralCredits (InvitePanelView.swift) + Android ReferralCredits.kt.

export const CREDIT_STATUSES = ['redeemed', 'converted'] as const;

/** Is this row a credit notice (a settled invite), as opposed to an open invite? */
export function isCredit(status: string): boolean {
  return (CREDIT_STATUSES as readonly string[]).includes(status);
}

/** The rows to show: every non-credit row, and the credits not dismissed. */
export function visibleCreditRows<T extends { id: string; status: string }>(rows: T[], dismissed: ReadonlySet<string>): T[] {
  return rows.filter((r) => !isCredit(r.status) || !dismissed.has(r.id));
}

/** "Clear all" shows at 2+ visible credit notices. */
export function showClearAll(rows: { status: string }[]): boolean {
  return rows.filter((r) => isCredit(r.status)).length >= 2;
}

export function dismissedKey(userId: string): string {
  return `referral-credits-dismissed:${userId}`;
}

/** The per-user local dismissed list (never throws; private mode → empty). */
export function readDismissed(userId: string, storage: Pick<Storage, 'getItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): Set<string> {
  try {
    const raw = storage?.getItem(dismissedKey(userId));
    const ids = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Add ids to the local list (keeps the newest 200). Returns the new set. */
export function writeDismissed(userId: string, ids: Iterable<string>, storage: Pick<Storage, 'getItem' | 'setItem'> | null = typeof window !== 'undefined' ? window.localStorage : null): Set<string> {
  const next = readDismissed(userId, storage);
  for (const id of ids) next.add(id);
  try { storage?.setItem(dismissedKey(userId), JSON.stringify([...next].slice(-200))); } catch { /* private mode */ }
  return next;
}
