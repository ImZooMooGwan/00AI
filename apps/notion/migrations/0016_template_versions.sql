CREATE TABLE IF NOT EXISTS template_versions (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  icon TEXT NOT NULL,
  visibility TEXT NOT NULL,
  license TEXT NOT NULL,
  blocks_json TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  UNIQUE(template_id,version)
);
CREATE INDEX IF NOT EXISTS template_versions_order ON template_versions(template_id,version DESC);
INSERT OR IGNORE INTO template_versions(id,template_id,version,title,description,category,icon,visibility,license,blocks_json,source_name,source_url,created_by,created_at)
SELECT lower(hex(randomblob(16))),id,version,title,description,category,icon,visibility,license,blocks_json,COALESCE(source_name,''),COALESCE(source_url,''),COALESCE(owner_id,(SELECT id FROM users ORDER BY created_at LIMIT 1)),updated_at
FROM templates
WHERE EXISTS (SELECT 1 FROM users) AND NOT EXISTS (SELECT 1 FROM template_versions tv WHERE tv.template_id=templates.id AND tv.version=templates.version);
