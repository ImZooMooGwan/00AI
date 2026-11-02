CREATE TABLE IF NOT EXISTS database_views (
  id TEXT PRIMARY KEY,
  database_id TEXT NOT NULL REFERENCES databases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  view_type TEXT NOT NULL CHECK(view_type IN ('table','board','calendar')),
  status_filter TEXT NOT NULL DEFAULT '전체',
  sort_by TEXT NOT NULL DEFAULT 'manual' CHECK(sort_by IN ('manual','due_date','title')),
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS database_views_order ON database_views(database_id,created_at);
