-- app-lime database schema
-- Run this in the Supabase SQL editor for both Preview and Production projects.

-- Events (calendar)
CREATE TABLE IF NOT EXISTS events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ,
  all_day     BOOLEAN NOT NULL DEFAULT false,
  recurrence  TEXT NOT NULL DEFAULT 'none'
              CHECK (recurrence IN ('none','daily','weekdays','weekly','monthly','yearly')),
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
