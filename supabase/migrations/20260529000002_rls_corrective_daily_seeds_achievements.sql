/*
  # RLS Corrective: daily_seeds INSERT policy + achievements re-assert

  Two issues surfaced by audit:

  1. `daily_seeds` has RLS enabled with a SELECT policy but NO INSERT
     policy, yet the client auto-creates the day's seed row on first
     access (daily-service.ts fetchDailySeed → .insert). If RLS is
     actually enforced on this table, daily puzzles break the first
     time anyone opens a mode each day. This adds the missing INSERT
     policy so seed generation works under RLS.

  2. `achievements` was reported by the Supabase SQL editor as having
     RLS DISABLED on the live DB, even though the original migration
     enabled it. This re-asserts RLS + the owner SELECT/INSERT policies
     so the table isn't readable/writable across users via the public
     anon key. Achievements are append-only, so no UPDATE/DELETE policy.

  All statements are idempotent (DROP POLICY IF EXISTS + CREATE, and
  ENABLE ROW LEVEL SECURITY is a no-op when already on), so this is
  safe to run regardless of the table's current live state.

  NOTE: run the verification query in the PR description first to see
  which tables actually have RLS off in production — there may be
  broader drift than these two tables, in which case a follow-up
  migration should normalize the rest.
*/

-- ── daily_seeds: allow authenticated clients to create the daily seed ──
ALTER TABLE daily_seeds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert daily seeds" ON daily_seeds;
CREATE POLICY "Anyone can insert daily seeds"
  ON daily_seeds FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ── achievements: re-assert RLS + owner-only read/insert ──────────────
ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own achievements" ON achievements;
CREATE POLICY "Users can view own achievements"
  ON achievements FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own achievements" ON achievements;
CREATE POLICY "Users can insert own achievements"
  ON achievements FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
