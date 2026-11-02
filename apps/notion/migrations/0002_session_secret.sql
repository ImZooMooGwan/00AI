CREATE TABLE IF NOT EXISTS app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);
