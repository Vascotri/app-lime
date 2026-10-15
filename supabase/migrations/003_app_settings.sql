-- Family-wide settings, as opposed to per-user ones.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- The shared calendar belongs to the household, not to whoever happened to
-- connect first. Slice 1 parked its id on google_tokens.calendar_id, one row
-- per person — which invites the question "whose id is right?" and risks each
-- user provisioning their own calendar. One row, one answer, no race.

CREATE TABLE IF NOT EXISTS app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Superseded by app_settings.family_calendar_id. Never written to, so dropping
-- it loses nothing.
ALTER TABLE google_tokens DROP COLUMN IF EXISTS calendar_id;
