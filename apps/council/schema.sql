PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meetings (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  committee TEXT NOT NULL DEFAULT '',
  broadcast_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'LIVE' CHECK (status IN ('LIVE','PAUSED','ENDED')),
  owner_email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS meetings_updated_idx ON meetings(updated_at DESC);

CREATE TABLE IF NOT EXISTS transcript_segments (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  text TEXT NOT NULL,
  start_ms INTEGER NOT NULL DEFAULT 0,
  end_ms INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'workers-ai',
  speaker TEXT NOT NULL DEFAULT '',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(meeting_id, client_id)
);
CREATE INDEX IF NOT EXISTS transcript_meeting_idx ON transcript_segments(meeting_id, start_ms);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS comments_meeting_idx ON comments(meeting_id, created_at);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  model TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reports_meeting_idx ON reports(meeting_id, created_at DESC);

-- Opaque 12-hour Council login sessions; raw session cookies are never stored.
CREATE TABLE IF NOT EXISTS council_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS council_sessions_expiry_idx ON council_sessions(expires_at);
