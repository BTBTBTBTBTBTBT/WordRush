-- FRIENDS v1 (2026-08-08): friendships + friend_taunts.
--
-- Design (bible §207): request→accept friendships power the All|Friends
-- leaderboard toggle, friends-visible private profiles, and the smack-talk
-- pushes (overtake + canned taunts). Reads are client-side via RLS; ALL
-- WRITES ARE SERVICE-ROLE ONLY through /api/friends/* — the referrals stance,
-- chosen because:
--   • the pair-block check ("did either side block the other?") cannot run
--     client-side — blocks SELECT is blocker-only (§B2 prelaunch hardening);
--   • pushes (request/accept/taunt/overtake) must originate server-side
--     (lib/push/broadcast.ts), so the mutation already lives in a route.
--
-- One row per pair regardless of direction (least/greatest unique index);
-- the requester/addressee columns preserve who asked. Decline and unfriend
-- DELETE the row — no tombstones (ShowLoud precedent).

create table if not exists public.friendships (
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);

-- One friendship per pair, whichever direction it was requested in.
create unique index if not exists friendships_pair_uniq
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

-- The "pending requests" badge query (match_invites precedent).
create index if not exists friendships_addressee_pending_idx
  on public.friendships (addressee_id, status)
  where status = 'pending';

alter table public.friendships enable row level security;

-- Both participants can read the row (unlike blocks, which is blocker-only).
create policy "Participants read friendships"
  on public.friendships for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- NO client insert/update/delete policies: writes go through /api/friends/*
-- with the service role (pair-block check + is_banned + idempotency + push).

-- Taunt rate limiting: one canned taunt per sender→recipient per local day.
-- Service-role only in both directions; the phrase list lives in
-- apps/web/lib/friends-taunts.ts and only ids are stored.
create table if not exists public.friend_taunts (
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  day text not null,             -- sender-local YYYY-MM-DD, matches daily_results.day
  taunt_id text not null,
  created_at timestamptz not null default now(),
  primary key (sender_id, recipient_id, day),
  check (sender_id <> recipient_id)
);

alter table public.friend_taunts enable row level security;
-- No policies at all: invisible to clients, service-role only.
