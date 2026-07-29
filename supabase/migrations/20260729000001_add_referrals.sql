-- Referral program: gift 7-day Pro trials, inviter earns Pro time on
-- redemption (small, instant) and on conversion (large, revenue-gated).
--
-- Design notes (see bible §161/§169):
--   * All WRITES are service-role only — the api/referrals/* routes and the
--     store-webhook fulfillment paths. Clients can only SELECT their own rows.
--     This mirrors store_webhook_events' service-role-only stance and keeps
--     the Pro-column lock (protect_pro_columns_trg) as the single grant gate.
--   * reward_granted_at prevents double-pay: invoice.paid fires EVERY month,
--     so without it one referral would pay the inviter forever.
--   * The partial unique index on invitee_id enforces one redemption per
--     account at the DB level — cheaper and stronger than an app check.

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  code text not null unique,
  invitee_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending','redeemed','converted','expired','revoked')),
  redeemed_at timestamptz,
  converted_at timestamptz,
  reward_granted_at timestamptz,
  converted_plan text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);

create unique index referrals_one_redemption_per_account
  on public.referrals (invitee_id) where invitee_id is not null;
create index referrals_inviter_status on public.referrals (inviter_id, status);
-- Monthly Top Inviters leaderboard scans redeemed_at.
create index referrals_redeemed_at on public.referrals (redeemed_at)
  where redeemed_at is not null;

alter table public.referrals enable row level security;

-- Inviter sees their own invites (the profile invite panel). No INSERT /
-- UPDATE / DELETE policies: those go through service-role API routes only.
create policy "Inviters read own referrals"
  on public.referrals for select
  using (auth.uid() = inviter_id);
