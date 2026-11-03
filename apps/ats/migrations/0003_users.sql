CREATE TABLE IF NOT EXISTS ats_users(
 email TEXT PRIMARY KEY COLLATE NOCASE,
 role TEXT NOT NULL CHECK(role IN('ADMIN','RECRUITER','REVIEWER')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN('ACTIVE','DISABLED')),
 created_by TEXT NOT NULL,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ats_users_status_role_idx ON ats_users(status,role);
