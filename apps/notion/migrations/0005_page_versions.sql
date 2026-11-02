CREATE TABLE IF NOT EXISTS page_versions (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES users(id),
  label TEXT NOT NULL DEFAULT '',
  content_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS page_versions_recent ON page_versions(page_id,created_at DESC);
