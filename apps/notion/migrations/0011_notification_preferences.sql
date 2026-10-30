CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  mentions_enabled INTEGER NOT NULL DEFAULT 1,
  page_shares_enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);
