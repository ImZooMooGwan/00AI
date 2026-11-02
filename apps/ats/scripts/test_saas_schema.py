"""Validate the public SaaS SQL migration with standard sqlite3 (no network required)."""
from pathlib import Path
import sqlite3, datetime

root = Path(__file__).resolve().parents[1]
connection = sqlite3.connect(':memory:')
connection.execute('PRAGMA foreign_keys = ON')
connection.executescript('''
CREATE TABLE candidates(id TEXT PRIMARY KEY,name TEXT NOT NULL,email TEXT NOT NULL,phone TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,deleted_at TEXT);
CREATE TABLE positions(id TEXT PRIMARY KEY,title TEXT NOT NULL,department TEXT,status TEXT NOT NULL DEFAULT 'OPEN',created_at TEXT NOT NULL);
CREATE TABLE applications(id TEXT PRIMARY KEY,candidate_id TEXT NOT NULL REFERENCES candidates(id),position_id TEXT REFERENCES positions(id),role TEXT NOT NULL,stage TEXT NOT NULL CHECK(stage IN('DOCUMENT','FIRST_INTERVIEW','FINAL_INTERVIEW','HIRED','REJECTED')),applied_at TEXT NOT NULL,experience TEXT,owner_email TEXT,owner_name TEXT,version INTEGER NOT NULL DEFAULT 1,memo TEXT DEFAULT '',rating REAL DEFAULT 0,resume_key TEXT,resume_name TEXT,updated_at TEXT NOT NULL);
CREATE TABLE stage_events(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),from_stage TEXT,to_stage TEXT NOT NULL,actor TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE email_templates(id TEXT PRIMARY KEY,name TEXT NOT NULL,subject TEXT NOT NULL,body_text TEXT NOT NULL,body_html TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,active INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL);
CREATE TABLE email_schedules(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),event_id TEXT NOT NULL,version INTEGER NOT NULL,template_version INTEGER NOT NULL,recipient_email TEXT NOT NULL,scheduled_at TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('PENDING','CANCELLED','PROCESSING','SENT','FAILED','DELIVERED','BOUNCED','UNKNOWN')),cancelled_at TEXT,claimed_at TEXT,sent_at TEXT,provider_message_id TEXT,retry_count INTEGER NOT NULL DEFAULT 0,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(event_id));
CREATE TABLE audit_logs(id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,details TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE TABLE evaluations(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),evaluator_email TEXT NOT NULL,score REAL,notes TEXT,submitted_at TEXT);
CREATE TABLE interviews(id TEXT PRIMARY KEY,application_id TEXT NOT NULL REFERENCES applications(id),starts_at TEXT NOT NULL,ends_at TEXT,interviewers TEXT NOT NULL,location TEXT,notes TEXT,status TEXT NOT NULL DEFAULT 'SCHEDULED');
INSERT INTO candidates VALUES('old-c','legacy','legacy@example.org',NULL,'2026-10-20','2026-10-20',NULL);
INSERT INTO applications(id,candidate_id,role,stage,applied_at,updated_at) VALUES('old-a','old-c','Legacy','DOCUMENT','2026-10-20','2026-10-20');
INSERT INTO email_templates VALUES('rejection-default','Original','Original','body','<p>body</p>',1,1,'2026-10-20');
''')
connection.executescript((root / 'migrations/0003_public_saas.sql').read_text())
assert connection.execute('SELECT organization_id FROM applications WHERE id="old-a"').fetchone()[0] == 'legacy-ats-quarantined'
assert connection.execute('SELECT status FROM organizations WHERE id="legacy-ats-quarantined"').fetchone()[0] == 'SUSPENDED'
connection.execute("INSERT INTO organizations(id,name,created_at) VALUES('org-A','A','2026-11-01'),('org-B','B','2026-11-01')")
connection.execute("INSERT INTO candidates(id,name,email,created_at,updated_at,organization_id) VALUES('a-c','User A','a@example.org','2026-11-01','2026-11-01','org-A'),('b-c','User B','b@example.org','2026-11-01','2026-11-01','org-B')")
connection.execute("INSERT INTO applications(id,candidate_id,role,stage,applied_at,updated_at,organization_id) VALUES('a-app','a-c','Engineer','DOCUMENT','2026-11-01','2026-11-01','org-A'),('b-app','b-c','Manager','DOCUMENT','2026-11-01','2026-11-01','org-B')")
assert connection.execute("SELECT COUNT(*) FROM applications WHERE organization_id='org-A'").fetchone()[0]==1
assert connection.execute("SELECT COUNT(*) FROM applications WHERE organization_id='org-B'").fetchone()[0]==1
try:
    connection.execute("INSERT INTO candidates(id,name,email,created_at,updated_at) VALUES('bad','bad','bad@example.org','now','now')")
    raise AssertionError('Missing organization ID was accepted')
except sqlite3.IntegrityError:
    pass
print('OK: legacy quarantine, tenant scoping, org guard triggers and migration schema')
