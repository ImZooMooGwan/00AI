CREATE TABLE IF NOT EXISTS page_content (
  page_id TEXT PRIMARY KEY REFERENCES pages(id) ON DELETE CASCADE,
  body_text TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS page_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, page_id)
);

CREATE TABLE IF NOT EXISTS page_visits (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL,
  PRIMARY KEY(user_id, page_id)
);
CREATE INDEX IF NOT EXISTS page_visits_recent ON page_visits(user_id, visited_at DESC);
