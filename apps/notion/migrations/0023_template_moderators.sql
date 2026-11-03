CREATE TABLE IF NOT EXISTS template_moderators (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO template_moderators(user_id,created_at)
SELECT id,created_at FROM users ORDER BY created_at,id LIMIT 1;
