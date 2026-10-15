-- Adds categories to tasks and events, and attendees to events.
--
-- Run this once in the Supabase SQL editor against the EXISTING project.
-- (supabase/schema.sql already contains these columns, for fresh projects.)
--
-- Safe on live data: every column is added with a default, so existing rows
-- land on 'other' / 'both' rather than failing the NOT NULL. Re-running is
-- harmless — the statements are guarded.

-- Tasks -----------------------------------------------------------------
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_category_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_category_check
  CHECK (category IN ('home','kids','personal','car','dog','travel','gifts','other'));

-- Events ----------------------------------------------------------------
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other';

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;
ALTER TABLE events ADD CONSTRAINT events_category_check
  CHECK (category IN ('home','kids','personal','work','other'));

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS attendees TEXT NOT NULL DEFAULT 'both';

ALTER TABLE events DROP CONSTRAINT IF EXISTS events_attendees_check;
ALTER TABLE events ADD CONSTRAINT events_attendees_check
  CHECK (attendees IN ('vasco','jennifer','both'));
