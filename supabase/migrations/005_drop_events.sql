-- Retires the Supabase events table. Google Calendar is now the system of
-- record for events; tasks and shopping_items are unaffected.
--
-- Run once in the Supabase SQL editor, AFTER deploying the Google write path.
--
-- IRREVERSIBLE. Verified empty before writing this (totalRows: 0 via the
-- diagnostic endpoint), so there is nothing to migrate — but if your project
-- holds rows, export them first:
--
--   SELECT * FROM events;
--
-- Earlier migrations (001) alter this table. They are a historical log for a
-- project that predates this file, not a script to replay from scratch: a
-- fresh project should use supabase/schema.sql, which no longer defines
-- events at all.

DROP TABLE IF EXISTS events;
