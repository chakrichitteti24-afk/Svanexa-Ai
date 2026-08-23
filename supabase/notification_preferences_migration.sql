-- ==============================================================================
-- Svanexa AI: Notification Preferences Schema Migration
-- ==============================================================================

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS notification_settings JSONB DEFAULT '{
  "enabled": true,
  "browserPush": true,
  "soundEnabled": true,
  "morningCheckin": true,
  "afternoonCheckin": true,
  "eveningCheckin": true,
  "wellnessTasks": true,
  "wellnessPlan": true,
  "coinsRewards": true,
  "cycleTracker": true,
  "aiCompanion": true,
  "reminderSchedule": {
    "morningTime": "08:30",
    "afternoonTime": "14:00",
    "eveningTime": "21:30"
  }
}'::jsonb;

ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';