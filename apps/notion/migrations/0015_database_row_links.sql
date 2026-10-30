CREATE TABLE IF NOT EXISTS database_row_links (
  id TEXT PRIMARY KEY,
  from_row_id TEXT NOT NULL REFERENCES database_rows(id) ON DELETE CASCADE,
  to_row_id TEXT NOT NULL REFERENCES database_rows(id) ON DELETE CASCADE,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  CHECK (from_row_id <> to_row_id),
  UNIQUE(from_row_id,to_row_id)
);
CREATE INDEX IF NOT EXISTS database_row_links_source ON database_row_links(from_row_id,created_at);
