-- app-lime database schema (full, for a fresh Supabase project).
--
-- An EXISTING project should be brought up to date with the files in
-- supabase/migrations/ instead — they preserve data.
--
-- The IN (...) lists below are mirrored by the union types in lib/types.ts and
-- asserted equal by lib/schema.test.ts, so the two cannot drift apart.

-- Events (calendar)
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  all_day     BOOLEAN NOT NULL DEFAULT false,
  recurrence  TEXT NOT NULL DEFAULT 'none'
              CHECK (recurrence IN ('none','daily','weekdays','weekly','monthly','yearly')),
  category    TEXT NOT NULL DEFAULT 'other'
              CHECK (category IN ('home','kids','personal','work','other')),
  attendees   TEXT NOT NULL DEFAULT 'both'
              CHECK (attendees IN ('vasco','jennifer','both')),
  notes       TEXT,
  created_by  TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE IF NOT EXISTS tasks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  description  TEXT,
  assigned_to  TEXT NOT NULL DEFAULT 'both'
               CHECK (assigned_to IN ('vasco','jennifer','both')),
  category     TEXT NOT NULL DEFAULT 'other'
               CHECK (category IN ('home','kids','personal','car','dog','travel','gifts','other')),
  due_date     DATE,
  completed_at TIMESTAMPTZ,
  created_by   TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shopping list
CREATE TABLE IF NOT EXISTS shopping_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  category   TEXT NOT NULL DEFAULT 'other'
             CHECK (category IN ('groceries','home','kids','other')),
  quantity   TEXT,
  checked_at TIMESTAMPTZ,
  added_by   TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security
-- All access goes through the server-side service role key (API routes),
-- so RLS is a defence-in-depth backstop — not the primary auth layer.
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_items ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS automatically; these policies cover anon/authenticated roles.
CREATE POLICY "family_only_events" ON events
  USING (true) WITH CHECK (true);

CREATE POLICY "family_only_tasks" ON tasks
  USING (true) WITH CHECK (true);

CREATE POLICY "family_only_shopping" ON shopping_items
  USING (true) WITH CHECK (true);
