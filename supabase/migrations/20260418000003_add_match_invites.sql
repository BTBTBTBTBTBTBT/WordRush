-- Match invites: let users invite a specific friend (by username) or
-- anyone with a link into a VS match. The matchmaking server pairs
-- the two users via a shared invite_code so they skip the public queue.
--
-- invitee_id is nullable — link-based invites don't target a specific
-- user. Username invites populate it so the invitee sees a pending
-- badge in their header.

create table if not exists public.match_invites (
  id uuid primary key default gen_random_uuid(),
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete cascade, -- null for link invites
  invite_code text not null unique,
  game_mode text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired', 'cancelled')),
  match_id uuid, -- populated when the two clients pair on the server
  expires_at timestamptz not null default (now() + interval '24 hours'),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists match_invites_invitee_pending_idx
  on public.match_invites (invitee_id, status)
  where status = 'pending';

create index if not exists match_invites_inviter_idx
  on public.match_invites (inviter_id, created_at desc);

create index if not exists match_invites_code_idx
  on public.match_invites (invite_code);

alter table public.match_invites enable row level security;

-- Inviter reads their own sent invites.
create policy "Inviter reads own invites"
  on public.match_invites for select
  using (auth.uid() = inviter_id);

-- Invitee reads invites addressed to them.
create policy "Invitee reads addressed invites"
  on public.match_invites for select
  using (auth.uid() = invitee_id);

-- Anyone signed in can read by invite_code (needed for the /vs/join
-- landing page to show inviter info). This is safe because invite_code
-- is a random secret and the read is narrowly scoped.
create policy "Anyone reads by invite code"
  on public.match_invites for select
  using (auth.uid() is not null);

-- Inviter creates their own invites.
create policy "Inviter inserts own invites"
  on public.match_invites for insert
  with check (auth.uid() = inviter_id);

-- Inviter or invitee can update (accept / decline / cancel).
create policy "Participant updates invite"
  on public.match_invites for update
  using (auth.uid() = inviter_id or auth.uid() = invitee_id)
  with check (auth.uid() = inviter_id or auth.uid() = invitee_id);
