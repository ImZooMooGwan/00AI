-- 00AI ATS PUBLIC SAAS MIGRATION
-- Apply after 0001 and 0002. Back up production D1 before running.
-- Historical records are QUARANTINED, not granted to the first new subscriber.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED')),
  email_enabled INTEGER NOT NULL DEFAULT 0,
  ai_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  email_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  disabled_at TEXT
);
CREATE TABLE IF NOT EXISTS memberships (
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  user_id TEXT NOT NULL REFERENCES app_users(id),
  role TEXT NOT NULL CHECK(role IN ('OWNER','ADMIN','RECRUITER','REVIEWER')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(organization_id,user_id)
);
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL COLLATE NOCASE,
  code_digest TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_email_idx ON otp_challenges(email,created_at);
CREATE TABLE IF NOT EXISTS login_rate_limits (
  bucket TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 0,
  window_expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES app_users(id),
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  token_digest TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id,expires_at);
CREATE TABLE IF NOT EXISTS organization_invites (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id),
  recipient_email TEXT NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','RECRUITER','REVIEWER')),
  token_digest TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  accepted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS email_template_versions (
  template_id TEXT NOT NULL REFERENCES email_templates(id),
  version INTEGER NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(template_id,version)
);
-- Existing D1 tables were created before organization scoping.
ALTER TABLE positions ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE candidates ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE applications ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE stage_events ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE email_templates ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE email_schedules ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE evaluations ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE interviews ADD COLUMN organization_id TEXT REFERENCES organizations(id);
ALTER TABLE audit_logs ADD COLUMN organization_id TEXT REFERENCES organizations(id);
-- Preserve existing data, but never expose it to public signup users.
INSERT OR IGNORE INTO organizations(id,name,status,email_enabled,ai_enabled,created_at)
VALUES('legacy-ats-quarantined','이전 ATS 데이터 (관리자 이관 필요)','SUSPENDED',0,0,datetime('now'));
UPDATE positions SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE candidates SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE applications SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE stage_events SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE email_templates SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE email_schedules SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE evaluations SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE interviews SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
UPDATE audit_logs SET organization_id='legacy-ats-quarantined' WHERE organization_id IS NULL;
INSERT OR IGNORE INTO email_template_versions(template_id,version,subject,body_text,body_html,created_at)
SELECT id,version,subject,body_text,body_html,updated_at FROM email_templates;
CREATE INDEX IF NOT EXISTS applications_org_stage_idx ON applications(organization_id,stage,updated_at);
CREATE INDEX IF NOT EXISTS candidates_org_email_idx ON candidates(organization_id,email);
CREATE INDEX IF NOT EXISTS positions_org_idx ON positions(organization_id,status);
CREATE INDEX IF NOT EXISTS email_org_due_idx ON email_schedules(organization_id,status,scheduled_at);
CREATE INDEX IF NOT EXISTS event_org_app_idx ON stage_events(organization_id,application_id);
CREATE INDEX IF NOT EXISTS audit_org_time_idx ON audit_logs(organization_id,created_at);
CREATE INDEX IF NOT EXISTS interviews_org_idx ON interviews(organization_id,starts_at);
CREATE INDEX IF NOT EXISTS evaluations_org_idx ON evaluations(organization_id,application_id);
CREATE INDEX IF NOT EXISTS membership_user_idx ON memberships(user_id,organization_id);
CREATE INDEX IF NOT EXISTS invites_email_idx ON organization_invites(recipient_email,expires_at);
-- Defense in depth against accidental tenantless writes.
CREATE TRIGGER IF NOT EXISTS app_org_required BEFORE INSERT ON applications WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
CREATE TRIGGER IF NOT EXISTS candidate_org_required BEFORE INSERT ON candidates WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
CREATE TRIGGER IF NOT EXISTS stage_org_required BEFORE INSERT ON stage_events WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
CREATE TRIGGER IF NOT EXISTS mail_org_required BEFORE INSERT ON email_schedules WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
CREATE TRIGGER IF NOT EXISTS audit_org_required BEFORE INSERT ON audit_logs WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
CREATE TRIGGER IF NOT EXISTS template_org_required BEFORE INSERT ON email_templates WHEN NEW.organization_id IS NULL BEGIN SELECT RAISE(ABORT,'organization_id is required'); END;
