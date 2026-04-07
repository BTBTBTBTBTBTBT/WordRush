-- Pro subscription fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_pro boolean DEFAULT false NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_expires_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pro_prompt_shown boolean DEFAULT false NOT NULL;
