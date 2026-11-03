ALTER TABLE page_invites ADD COLUMN expires_at TEXT;

UPDATE page_invites
SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+7 days')
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS page_invites_expiry
  ON page_invites(page_id, accepted_at, expires_at);
