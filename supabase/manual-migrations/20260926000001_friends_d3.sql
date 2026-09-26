-- FRIENDS D3 (Stats + Friends redesign, founder 2026-09-26) — the schema the
-- remaining Friends work needs. HAND-APPLIED in the SQL editor after a fresh
-- `scripts/db-backup.sh` run (the project is on the Supabase FREE plan: no
-- PITR, no daily backups). Nothing here is read by shipped code until the
-- matching routes land, so applying it early is safe; applying it late only
-- leaves the new cards empty.
--
-- 1. weekly_race_results — the Sunday finish. The weekly friends race used to
--    be recomputed on every visit and was never settled: on Monday the podium
--    simply reset and "who won?" was a client-side guess. Now the FIRST visit
--    after a week closes (the client's own Monday 00:00 — the same local week
--    boundary every friends surface already uses) settles that week for the
--    viewer: one row per (user, week_start) with their rank, points and the
--    circle size, written by /api/friends with the service role. A Monday
--    banner ("You finished 2nd of 6") and a trophy row on the profile read it.
--    ONE definition of the week, server-computed, never a client sort.
create table if not exists public.weekly_race_results (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start text not null,            -- Monday, viewer-local YYYY-MM-DD
  rank integer not null,
  points integer not null,
  circle_size integer not null,        -- friends + me at settlement time
  winner_id uuid references public.profiles(id) on delete set null,
  winner_points integer,
  settled_at timestamptz not null default now(),
  primary key (user_id, week_start)
);
alter table public.weekly_race_results enable row level security;
-- The owner and their accepted friends can read a row (the feed says "Doug won last week").
create policy "Owner and friends read weekly race results"
  on public.weekly_race_results for select to authenticated
  using (
    auth.uid() = user_id
    or exists (
      select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.requester_id = auth.uid() and f.addressee_id = user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = user_id))
    )
  );
-- No client writes: /api/friends settles with the service role.

-- 2. shield_gifts — streak-shield gifting. A friend about to lose a streak can
--    be sent one of YOUR shields (profiles.streak_shields, a paid/referral
--    benefit — service-role only, protect_pro_columns stance). Once per
--    (sender, recipient, week_start); the route decrements the sender,
--    increments the recipient, pushes the recipient and writes the feed row.
create table if not exists public.shield_gifts (
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  week_start text not null,            -- sender-local Monday YYYY-MM-DD
  created_at timestamptz not null default now(),
  primary key (sender_id, recipient_id, week_start),
  check (sender_id <> recipient_id)
);
alter table public.shield_gifts enable row level security;
create policy "Participants read shield gifts"
  on public.shield_gifts for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = recipient_id);
-- No client writes: /api/friends/gift-shield only.

-- 3. Notification preferences — per-event opt-outs for the Friends pushes
--    (race finish, challenge, nudge/taunt, feed moments). Missing keys mean ON.
--    Written by the owner from the Friends tab's bell menu; read by
--    lib/push/broadcast.ts callers before they push.
alter table public.profiles
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

-- 4. The viewer's IANA timezone, saved on load by every client, so server-side
--    settlement and the (future) Sunday-night race reminder use the SAME week
--    boundary the client shows. Nullable: an old client never writes it and
--    the server falls back to the client-supplied weekStart.
alter table public.profiles
  add column if not exists timezone text;

-- Read-back after applying:
--   select table_name from information_schema.tables where table_schema='public'
--     and table_name in ('weekly_race_results','shield_gifts');
--   select column_name from information_schema.columns where table_name='profiles'
--     and column_name in ('notification_prefs','timezone');
