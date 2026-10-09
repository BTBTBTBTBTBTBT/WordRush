// ============================================================
// Branded one-link invites (FRIDAY-QUEUE item 9f) — shared pure rules.
// ============================================================
// Gate: isFeatureLive('branded_invites'). Off = today's links (/vs/join/<CODE>, /vs/challenge/<CODE>)
// and the old "Race me at X! url" share line.
//
// ONE url per invite, whose share preview is a per-invite image:
//   wordocious.com/vs/<CODE>      a live VS invite OR a race-my-run challenge (the server knows which)
//   wordocious.com/friend/<CODE>  a friend / gift invite (the referral code)
// Codes are 8 characters from the invite alphabet (no 0/O/1/I), so `/vs/????????` is unambiguous
// next to the static /vs/bots, /vs/live, /vs/join, /vs/challenge, /vs/friend pages.
//
// Mirrored by BrandedInvite.swift / BrandedInvite.kt (pinned by branded-invite.test.ts).

export const BRANDED_INVITES_SWITCH = 'branded_invites';

export type InviteLinkKind = 'vs' | 'friend';

export const INVITE_ORIGIN = 'https://wordocious.com';

/** The code alphabet shared by match_invites / vs_challenges (no 0 O 1 I). */
export const INVITE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Live-VS and race-my-run codes are exactly this long. */
export const VS_CODE_LENGTH = 8;

/** Static /vs/* segments a code can never be (kept for the router + AASA exclusions). */
export const VS_RESERVED_SEGMENTS = ['bots', 'live', 'join', 'challenge', 'friend'] as const;

/** Uppercase, strip everything that is not a letter or digit. */
export function cleanInviteCode(raw: string | null | undefined): string {
  return (raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** A well-formed VS code: 8 characters, all from the invite alphabet. */
export function isVsCode(code: string): boolean {
  if (code.length !== VS_CODE_LENGTH) return false;
  for (const ch of code) if (!INVITE_CODE_ALPHABET.includes(ch)) return false;
  return true;
}

/** A referral / friend code (4 to 16 characters, the referral alphabet). */
export function isFriendCode(code: string): boolean {
  return /^[A-Z2-9]{4,16}$/.test(code);
}

export function inviteUrl(kind: InviteLinkKind, code: string): string {
  return `${INVITE_ORIGIN}/${kind === 'vs' ? 'vs' : 'friend'}/${cleanInviteCode(code)}`;
}

export interface ParsedInvitePath { kind: InviteLinkKind; code: string }

/**
 * Parse a path (or full url) into an invite link. Accepts the new one-link form and the old
 * forms (/vs/join/<CODE>, /vs/challenge/<CODE>, /join/<CODE>) so "Have a code?" can paste either.
 */
export function parseInvitePath(input: string): ParsedInvitePath | null {
  let path = input.trim();
  const m = path.match(/^https?:\/\/(?:www\.)?wordocious\.com(\/.*)?$/i);
  if (m) path = m[1] ?? '/';
  path = path.split(/[?#]/)[0].replace(/\/+$/, '');
  const parts = path.split('/').filter(Boolean);
  if (parts.length === 2 && parts[0].toLowerCase() === 'vs') {
    if ((VS_RESERVED_SEGMENTS as readonly string[]).includes(parts[1].toLowerCase())) return null;
    const code = cleanInviteCode(parts[1]);
    return isVsCode(code) ? { kind: 'vs', code } : null;
  }
  if (parts.length === 3 && parts[0].toLowerCase() === 'vs' && ['join', 'challenge'].includes(parts[1].toLowerCase())) {
    const code = cleanInviteCode(parts[2]);
    return isVsCode(code) ? { kind: 'vs', code } : null;
  }
  if (parts.length === 2 && ['friend', 'join'].includes(parts[0].toLowerCase())) {
    const code = cleanInviteCode(parts[1]);
    return isFriendCode(code) ? { kind: 'friend', code } : null;
  }
  return null;
}

/** What the "Have a code?" field accepts: a bare code or any invite link. */
export function parseTypedInvite(input: string): ParsedInvitePath | null {
  const fromLink = parseInvitePath(input);
  if (fromLink) return fromLink;
  const code = cleanInviteCode(input);
  if (isVsCode(code)) return { kind: 'vs', code };
  return null;
}

// ── Preview copy ────────────────────────────────────────────────────────────

export type InviteVariant = 'live' | 'race' | 'friend';

export interface InviteCopyInput {
  variant: InviteVariant;
  /** Sender's username (no @). */
  sender: string;
  /** Game title as shown in the app, e.g. "Classic". */
  game?: string;
  /** Race my run: "solved in 4 · 1:12" / "a run to beat". */
  raceLine?: string;
}

/** The short text that rides beside the link (no separate code line). */
export function inviteShareLine(i: InviteCopyInput): string {
  const game = i.game ?? 'a game';
  switch (i.variant) {
    case 'live': return `${i.sender} wants to race you in ${game}`;
    case 'race': return `${i.sender} challenged you to beat their ${game} run`;
    case 'friend': return `${i.sender} invited you to Wordocious`;
  }
}

/** The big line on the preview image + the page headline. */
export function inviteHeadline(i: InviteCopyInput): string {
  const game = (i.game ?? 'a game').toUpperCase();
  switch (i.variant) {
    case 'live': return `${i.sender} challenges you to ${game}`;
    case 'race': return `${i.sender} challenges you to ${game}`;
    case 'friend': return `${i.sender} invited you to Wordocious`;
  }
}

/** The smaller line under the headline (race time to beat, or the pitch). */
export function inviteSubline(i: InviteCopyInput): string {
  switch (i.variant) {
    case 'live': return 'A live head-to-head. Tap to join the match.';
    case 'race': return i.raceLine ? `Beat their run: ${i.raceLine}` : 'Beat their run within 24 hours.';
    case 'friend': return 'Daily word games, played with friends. A week of Pro is on them.';
  }
}

/** "solved in 4 · 1:12" or "a run to beat" from a stored run. */
export function raceLine(run: { solved: boolean; guesses: number; timeMs: number }): string {
  if (!run.solved) return 'a run to beat';
  const total = Math.max(0, Math.round(run.timeMs / 1000));
  const clock = `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  return `solved in ${run.guesses} · ${clock}`;
}

/** Page <title> / og:title. */
export function inviteTitle(i: InviteCopyInput): string {
  return inviteHeadline(i);
}
