ALTER TABLE notification_preferences ADD COLUMN mentions_email_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE notification_preferences ADD COLUMN page_shares_email_enabled INTEGER NOT NULL DEFAULT 0;
