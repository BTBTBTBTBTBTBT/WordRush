/**
 * The Invites row's data rules (FRIDAY-QUEUE 9f): merge pending live VS invites and incoming race-my-run
 * challenges into one newest-first list, minus the ones the player declined on this device. Pure; the
 * component does the fetching. Mirrored by InvitesRow.swift / InvitesRow.kt.
 */
export interface LiveInviteIn { id: string; code: string; gameMode: string; inviterId: string; sender: string; createdAt: string }
export interface RaceInviteIn { code: string; gameMode: string; challengerId: string; sender: string; createdAt: string; raceLine: string }

export interface InviteRow {
  key: string;
  variant: 'live' | 'race';
  code: string;
  gameMode: string;
  sender: string;
  senderId: string;
  raceLine?: string;
  /** match_invites.id (live only), for the decline write. */
  inviteId?: string;
  createdAt: string;
}

export function buildInviteRows(i: { live: LiveInviteIn[]; races: RaceInviteIn[]; dismissed: string[] }): InviteRow[] {
  const gone = new Set(i.dismissed.map((c) => c.toUpperCase()));
  const rows: InviteRow[] = [
    ...i.live.map((l): InviteRow => ({ key: `live:${l.code}`, variant: 'live', code: l.code, gameMode: l.gameMode, sender: l.sender, senderId: l.inviterId, inviteId: l.id, createdAt: l.createdAt })),
    ...i.races.map((r): InviteRow => ({ key: `race:${r.code}`, variant: 'race', code: r.code, gameMode: r.gameMode, sender: r.sender, senderId: r.challengerId, raceLine: r.raceLine, createdAt: r.createdAt })),
  ];
  return rows
    .filter((r) => !gone.has(r.code.toUpperCase()))
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

const KEY = 'wr_dismissed_invites';

/** Declined race challenges (they have no server-side decline): remembered per device, newest 50. */
export function loadDismissed(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(raw) ? raw.filter((c): c is string => typeof c === 'string') : [];
  } catch { return []; }
}

export function saveDismissed(codes: string[]): void {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(codes)).slice(-50))); } catch { /* storage off */ }
}
