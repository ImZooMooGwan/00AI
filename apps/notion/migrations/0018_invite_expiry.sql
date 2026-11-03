ALTER TABLE workspace_invites ADD COLUMN expires_at TEXT;

UPDATE workspace_invites
SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+7 days')
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS workspace_invites_expiry
  ON workspace_invites(workspace_id, accepted_at, expires_at);
