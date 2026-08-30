-- Add active_companion_skin column to profiles table
-- This stores the user's selected companion avatar skin

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS active_companion_skin TEXT NOT NULL DEFAULT 'dynamic';

-- Add index for quick lookup
CREATE INDEX IF NOT EXISTS idx_profiles_active_companion_skin
  ON profiles (active_companion_skin);

COMMENT ON COLUMN profiles.active_companion_skin IS
  'The companion avatar skin selected by the user. Default is dynamic (mood-based).';
