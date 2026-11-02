CREATE TABLE IF NOT EXISTS email_template_versions(
  template_id TEXT NOT NULL REFERENCES email_templates(id),
  version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(template_id, version)
);
INSERT OR IGNORE INTO email_template_versions(template_id,version,subject,body_text,body_html,created_at)
SELECT id,version,subject,body_text,body_html,updated_at FROM email_templates;
CREATE UNIQUE INDEX IF NOT EXISTS evaluations_application_evaluator_idx ON evaluations(application_id,evaluator_email);
CREATE INDEX IF NOT EXISTS interviews_application_idx ON interviews(application_id,starts_at);
