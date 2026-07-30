-- Atomic inviter rewards for the referral program.
--
-- The TS path did: count redemptions → maybe extend Pro → read shields → write
-- shields+4. Three separate round trips, so two redemptions landing together
-- could both read the same count (double instant reward, double milestone) or
-- interleave the shield read/write and lose one (classic lost update).
--
-- This runs the whole decision inside one transaction, serialized per inviter
-- by a FOR UPDATE lock on their profile row. Concurrent redemptions for the
-- same inviter now queue instead of racing; different inviters don't block.
--
-- The milestone is made IDEMPOTENT rather than count-equality based: the old
-- `count == 3` test could fire twice (race) or never (if a redemption was later
-- revoked and the count re-crossed 3). profiles.referral_milestone_at is
-- stamped once and checked thereafter, so the shields are granted exactly once
-- per inviter, ever.
--
-- SECURITY DEFINER so it owns the Pro-column write regardless of the
-- protect_pro_columns trigger; callable only by service_role.

alter table public.profiles
  add column if not exists referral_milestone_at timestamptz;

create or replace function public.grant_referral_inviter_rewards(
  p_inviter uuid,
  p_instant_days int,
  p_cap int,
  p_milestone_at int,
  p_milestone_shields int
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_redemptions int;
  v_milestone_at timestamptz;
  v_granted_instant boolean := false;
  v_granted_shields boolean := false;
begin
  -- Serializes concurrent redemptions for THIS inviter.
  select referral_milestone_at into v_milestone_at
    from profiles where id = p_inviter for update;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'inviter_missing');
  end if;

  select count(*) into v_redemptions
    from referrals
   where inviter_id = p_inviter
     and status in ('redeemed', 'converted');

  -- Instant reward, capped by lifetime redemptions. Additive via greatest():
  -- an existing future expiry is extended, never truncated (mirrors the
  -- Math.max pattern in stripe-fulfillment.ts).
  if v_redemptions <= p_cap then
    update profiles
       set is_pro = true,
           pro_expires_at = greatest(coalesce(pro_expires_at, now()), now())
                            + make_interval(days => p_instant_days)
     where id = p_inviter;
    v_granted_instant := true;
  end if;

  -- Milestone shields: once per inviter, ever.
  if v_redemptions >= p_milestone_at and v_milestone_at is null then
    update profiles
       set streak_shields = coalesce(streak_shields, 0) + p_milestone_shields,
           referral_milestone_at = now()
     where id = p_inviter;
    v_granted_shields := true;
  end if;

  return jsonb_build_object(
    'ok', true,
    'redemptions', v_redemptions,
    'granted_instant', v_granted_instant,
    'granted_shields', v_granted_shields
  );
end;
$$;

revoke all on function public.grant_referral_inviter_rewards(uuid, int, int, int, int) from public, anon, authenticated;
grant execute on function public.grant_referral_inviter_rewards(uuid, int, int, int, int) to service_role;
