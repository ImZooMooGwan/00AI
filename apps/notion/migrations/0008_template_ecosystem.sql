ALTER TABLE templates ADD COLUMN owner_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE templates ADD COLUMN source_name TEXT NOT NULL DEFAULT '';
ALTER TABLE templates ADD COLUMN source_url TEXT NOT NULL DEFAULT '';
ALTER TABLE templates ADD COLUMN review_status TEXT NOT NULL DEFAULT 'published' CHECK(review_status IN ('published','pending','rejected'));
ALTER TABLE templates ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE templates ADD COLUMN copy_count INTEGER NOT NULL DEFAULT 0;
UPDATE templates SET review_status='published',source_name='00AI WORKSPACE' WHERE owner_id IS NULL;
CREATE INDEX IF NOT EXISTS templates_public_listing ON templates(visibility,review_status,category,title);

CREATE TABLE IF NOT EXISTS template_reports (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS template_reports_queue ON template_reports(resolved_at,created_at);
