-- Admin system: role, ban, announcements, audit log

-- Role column on profiles (protected by trigger below)
ALTER TABLE profiles ADD COLUMN role text NOT NULL DEFAULT 'user';
ALTER TABLE profiles ADD CONSTRAINT valid_role CHECK (role IN ('user', 'admin'));

-- Ban fields
ALTER TABLE profiles ADD COLUMN is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN ban_reason text;

-- Prevent users from self-escalating role via their own RLS update policy
CREATE OR REPLACE FUNCTION prevent_role_self_update() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_setting('request.jwt.claims', true)::json->>'role' != 'service_role' THEN
      RAISE EXCEPTION 'Cannot change role field';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_role_column
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_role_self_update();

-- Announcements table (MOTD, events, warnings)
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  active boolean NOT NULL DEFAULT true,
  starts_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active announcements" ON announcements
  FOR SELECT USING (active = true AND (expires_at IS NULL OR expires_at > now()));

-- Admin audit log for tracking admin actions
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id),
  action text NOT NULL,
  target_user_id uuid REFERENCES profiles(id),
  details jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
-- No public RLS policies — only accessible via service_role
