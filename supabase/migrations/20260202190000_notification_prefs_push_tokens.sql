-- Notification preferences on users; RLS for push_tokens.
-- TODO: quiet hours — add quiet_hours_start, quiet_hours_end (TIME) and timezone to users;
--       then in send logic skip sending when current time (in user TZ) is within that window.
-- File: supabase/migrations/20260202190000_notification_prefs_push_tokens.sql

-- User notification preferences (respect when sending push)
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notify_lineup_published BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_score_change BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_full_time BOOLEAN NOT NULL DEFAULT true;

-- RLS: push_tokens — users manage their own tokens only
-- Idempotent: drop policy if it exists, then create.
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users can manage own push tokens"
  ON public.push_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
