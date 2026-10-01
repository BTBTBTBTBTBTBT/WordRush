-- Word of the Day quiz answers (founder-approved home redesign, 2026-10-01).
-- One answer per player per local day: the card shows three definitions, the
-- player picks one, and the result drives the word streak (consecutive days
-- answered right). Answers can't be changed, so there is no UPDATE policy.
create table if not exists public.word_quiz_answers (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  word text not null,
  picked smallint not null check (picked between 0 and 2),
  correct boolean not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.word_quiz_answers enable row level security;

drop policy if exists "Players read own quiz answers" on public.word_quiz_answers;
create policy "Players read own quiz answers" on public.word_quiz_answers
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "Players insert own quiz answers" on public.word_quiz_answers;
create policy "Players insert own quiz answers" on public.word_quiz_answers
  for insert to authenticated with check (auth.uid() = user_id);
