-- Stores the Google OAuth refresh token per family member, so the server can
-- act on the shared calendar.
--
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Why a table rather than the session cookie: a refresh token in the JWT is
-- only available while that user is making a request. Keeping it here lets a
-- later background job (sync, reminders) act without someone being logged in,
-- and survives a cleared cookie — Google only re-issues a refresh token on a
-- fresh consent, so losing one means an awkward re-connect.

CREATE TABLE IF NOT EXISTS google_tokens (
  email         TEXT PRIMARY KEY,
  refresh_token TEXT NOT NULL,
  access_token  TEXT,
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  calendar_id   TEXT,            -- the shared Family calendar, set in a later slice
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- These are credentials. Only the service role (our API routes) may touch them:
-- RLS on with no policies means anon and authenticated roles are denied
-- outright, while the service role bypasses RLS as usual.
ALTER TABLE google_tokens ENABLE ROW LEVEL SECURITY;
