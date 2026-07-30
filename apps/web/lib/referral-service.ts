/**
 * Referral program (server-side, service-role only).
 *
 * The loop: a player shares wordocious.com/join/<CODE>. A brand-new friend
 * who signs up through it gets 7 days of Pro. The inviter earns:
 *   * +3 days Pro instantly per redemption (first INSTANT_REWARD_CAP only —
 *     fake-account farming yields nothing past the cap),
 *   * +4 streak shields at the 3rd redemption (milestone),
 *   * +30 days (monthly) / +90 days (yearly) when the friend SUBSCRIBES —
 *     the big reward is revenue-gated, so the expensive payout only fires
 *     when real money arrives. pro_day NEVER triggers it (a $1 pass must not
 *     buy a $6.99 month).
 *
 * Every Pro grant here is ADDITIVE via the Math.max pattern from
 * stripe-fulfillment.ts — never reset-from-now (the admin route's mistake),
 * so a paying subscriber's window is never truncated.
 */

import { getAdminSupabase } from './supabase-admin';

const DAY_MS = 86_400_000;

export const REFERRAL_TRIAL_DAYS = 7;
const INSTANT_REWARD_DAYS = 3;
const INSTANT_REWARD_CAP = 5;   // instant +3d only for the first 5 redemptions
const MILESTONE_SHIELDS_AT = 3; // +4 shields when the 3rd friend redeems
const MILESTONE_SHIELDS = 4;
export const MAX_PENDING_INVITES = 3;
const CONVERSION_REWARD_DAYS: Record<string, number> = {
  pro_monthly: 30,
  pro_yearly: 90, // 3 free months when the friend goes annual (founder call 2026-07-29)
};

/** Extend a user's Pro window by N days — additive, never shrinking. */
async function extendPro(userId: string, days: number): Promise<void> {
  const sb = getAdminSupabase();
  const { data } = await sb.from('profiles')
    .select('pro_expires_at').eq('id', userId).maybeSingle();
  const storedMs = data?.pro_expires_at ? new Date(data.pro_expires_at).getTime() : 0;
  const base = Math.max(storedMs, Date.now());
  const expires = new Date(base + days * DAY_MS).toISOString();
  const { error } = await sb.from('profiles')
    .update({ is_pro: true, pro_expires_at: expires }).eq('id', userId);
  if (error) throw new Error(`referral pro grant failed: ${error.message}`);
}

/**
 * Redeem a referral code for a freshly signed-up user. Enforces all
 * anti-fraud rules; returns a machine-readable result for the caller.
 * The partial unique index on invitee_id is the backstop for the
 * one-redemption-per-account rule under concurrency.
 */
export async function redeemReferral(userId: string, code: string): Promise<
  | { ok: true; inviterId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'self' | 'already_redeemed' | 'not_eligible' }
> {
  const sb = getAdminSupabase();

  const { data: ref } = await sb.from('referrals')
    .select('id, inviter_id, status, expires_at')
    .eq('code', code.toUpperCase())
    .maybeSingle();
  if (!ref || ref.status !== 'pending') return { ok: false, reason: 'not_found' };
  if (new Date(ref.expires_at).getTime() < Date.now()) return { ok: false, reason: 'expired' };
  if (ref.inviter_id === userId) return { ok: false, reason: 'self' };

  // Redeemer must never have had Pro — blocks existing subscribers (and
  // prior trial users) from farming fresh trials with a friend's code.
  const { data: profile } = await sb.from('profiles')
    .select('is_pro, pro_expires_at').eq('id', userId).maybeSingle();
  if (!profile) return { ok: false, reason: 'not_eligible' };
  if (profile.is_pro || profile.pro_expires_at) return { ok: false, reason: 'not_eligible' };

  // Claim the row. `.eq('status','pending')` makes this the compare-and-swap
  // that decides the winner under concurrency, so the RETURNED ROWS — not just
  // the absence of an error — are what say we won: PostgREST reports an update
  // matching zero rows as success, so two simultaneous claims of the SAME code
  // both saw "no error" and both paid out (double trial + double inviter
  // bonus). The invitee_id unique index doesn't help here — it only fires when
  // one account claims two DIFFERENT codes, not when two requests race for one.
  const { data: claimed, error: claimErr } = await sb.from('referrals')
    .update({ invitee_id: userId, status: 'redeemed', redeemed_at: new Date().toISOString() })
    .eq('id', ref.id)
    .eq('status', 'pending')
    .select('id');
  if (claimErr) {
    return { ok: false, reason: claimErr.code === '23505' ? 'already_redeemed' : 'not_found' };
  }
  if (!claimed || claimed.length === 0) return { ok: false, reason: 'already_redeemed' };

  // Friend's 7-day trial.
  await extendPro(userId, REFERRAL_TRIAL_DAYS);

  // Inviter's instant rewards. One atomic RPC rather than count → extend →
  // read shields → write shields: those four round trips let two simultaneous
  // redemptions read the same count (double reward) or interleave the shield
  // read/write and lose one. The function locks the inviter's profile row, so
  // concurrent redemptions for the same inviter queue instead of racing, and
  // stamps a milestone flag so the shields land exactly once ever.
  //
  // Isolated in try/catch because the row is already claimed and the friend's
  // trial already granted at this point — a failure paying the INVITER must not
  // report the redemption as failed to the FRIEND, who would then retry and be
  // told the code was already used.
  try {
    const { error: rewardErr } = await sb.rpc('grant_referral_inviter_rewards', {
      p_inviter: ref.inviter_id,
      p_instant_days: INSTANT_REWARD_DAYS,
      p_cap: INSTANT_REWARD_CAP,
      p_milestone_at: MILESTONE_SHIELDS_AT,
      p_milestone_shields: MILESTONE_SHIELDS,
    });
    if (rewardErr) throw new Error(rewardErr.message);
  } catch (e) {
    console.error('[referrals] inviter reward failed (friend trial unaffected):', e);
  }

  return { ok: true, inviterId: ref.inviter_id };
}

/**
 * Conversion hook — call from EVERY fulfillment path after a successful
 * subscription grant (Stripe webhook, App Store notifications, Play RTDN).
 * No-op unless the buyer was a redeemed referral whose reward is unpaid.
 * Never throws: a referral bug must not fail payment fulfillment.
 */
export async function maybeGrantReferralReward(userId: string, planId: string): Promise<void> {
  try {
    const days = CONVERSION_REWARD_DAYS[planId];
    if (!days) return; // pro_day and unknown plans never pay

    const sb = getAdminSupabase();
    const { data: ref } = await sb.from('referrals')
      .select('id, inviter_id, reward_granted_at')
      .eq('invitee_id', userId)
      .eq('status', 'redeemed')
      .maybeSingle();
    if (!ref || ref.reward_granted_at) return;

    // Stamp BEFORE granting so a concurrent duplicate webhook can't double-pay;
    // the .is() filter makes the stamp itself race-safe.
    const { data: stamped } = await sb.from('referrals')
      .update({
        status: 'converted',
        converted_at: new Date().toISOString(),
        reward_granted_at: new Date().toISOString(),
        converted_plan: planId,
      })
      .eq('id', ref.id)
      .is('reward_granted_at', null)
      .select('id');
    if (!stamped || stamped.length === 0) return; // lost the race — already paid

    await extendPro(ref.inviter_id, days);
  } catch (e) {
    console.error('[referrals] conversion reward failed (fulfillment unaffected):', e);
  }
}
