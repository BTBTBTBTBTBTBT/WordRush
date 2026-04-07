-- SpellCoins: in-app currency system
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS coins integer DEFAULT 0 NOT NULL;

CREATE TABLE IF NOT EXISTS coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  type text NOT NULL,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT valid_type CHECK (type IN ('earn', 'spend'))
);

CREATE INDEX IF NOT EXISTS idx_coin_tx_user ON coin_transactions(user_id, created_at DESC);

ALTER TABLE coin_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions"
  ON coin_transactions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own transactions"
  ON coin_transactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
