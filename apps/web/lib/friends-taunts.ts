/**
 * FRIENDS — the canned taunt list (bible §207).
 *
 * Smack talk with zero free text: clients render these fixed phrases in the
 * taunt picker and send only the id; /api/friends/taunt validates the id
 * against this list and pushes the phrase. No user-generated content ever
 * crosses the wire, which is what keeps taunts out of App Review's UGC
 * territory (Guideline 1.2 — block/report/unfriend already exist).
 *
 * Rate limit: one taunt per sender→recipient per local day, enforced by the
 * friend_taunts primary key. Tone rule for additions: playful rivalry, never
 * personal — every phrase must read fine arriving from a stranger you
 * friended once and forgot about.
 */
export interface FriendTaunt {
  id: string;
  text: string;
}

export const FRIEND_TAUNTS: FriendTaunt[] = [
  { id: 'hi', text: '👋 Hey! Glad we’re friends — game on.' },
  { id: 'sweep', text: '🧹 Swept it. Your move.' },
  { id: 'silver', text: '🥈 Silver looks good on you' },
  { id: 'slowpoke', text: '🐢 Still waiting on you today…' },
  { id: 'scoreboard', text: '👀 The scoreboard has spoken' },
  { id: 'warmup', text: '📈 Cute score. Was that a warm-up?' },
  { id: 'crown', text: '👑 The crown stays here' },
  { id: 'rentfree', text: '🏠 Top of the board — rent free' },
  { id: 'alarm', text: '⏰ Your daily puzzles miss you' },
];

export function tauntById(id: string): FriendTaunt | undefined {
  return FRIEND_TAUNTS.find((t) => t.id === id);
}
