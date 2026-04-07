-- Cosmetics: owned items and equipped loadout
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS owned_cosmetics text[] DEFAULT '{}' NOT NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS equipped_cosmetics jsonb DEFAULT '{}' NOT NULL;
