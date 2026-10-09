import { parseTypedInvite } from '@wordle-duel/core';

/**
 * "Have a code?" (FRIDAY-QUEUE 9f): one field that takes a bare code OR any invite link
 * (wordocious.com/vs/<CODE>, the old /vs/join/ and /vs/challenge/ forms, /friend/ and /join/).
 * Resolves it to the page that does the actual accepting. Injected lookups keep it testable.
 */
export interface JoinDeps {
  /** Race-my-run lookup (GET /api/vs/challenges/<code>). */
  challenge: (code: string) => Promise<{ ok: true } | { ok: false; status: number; error: string }>;
  /** Live private-match invite lookup. */
  invite: (code: string) => Promise<{ status: string; expires_at: string; game_mode: string; invite_code: string } | null>;
  /** The mode's VS route (vsHrefForMode). */
  vsHref: (gameMode: string) => string;
  now?: () => number;
}

export type JoinResult = { href: string } | { error: string };

export async function resolveTypedCode(typed: string, deps: JoinDeps): Promise<JoinResult> {
  const parsed = parseTypedInvite(typed);
  if (!parsed) return { error: 'That does not look like an invite code or link.' };
  if (parsed.kind === 'friend') return { href: `/join/${parsed.code}` };

  // A race-my-run challenge first, then a live private-match code (same order the lobby always used).
  const ch = await deps.challenge(parsed.code);
  if (ch.ok) return { href: `/vs/challenge/${parsed.code}` };
  const invite = await deps.invite(parsed.code);
  const now = (deps.now ?? Date.now)();
  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at).getTime() < now) {
    return { error: ch.status === 403 ? ch.error : 'No match found for that code.' };
  }
  return { href: `${deps.vsHref(invite.game_mode)}?inviteCode=${invite.invite_code}` };
}
