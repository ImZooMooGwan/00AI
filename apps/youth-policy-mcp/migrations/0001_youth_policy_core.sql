PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS policies (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_policy_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  support_details TEXT NOT NULL DEFAULT '',
  large_category TEXT,
  medium_category TEXT,
  managing_organization TEXT,
  operating_organization TEXT,
  region_codes_json TEXT NOT NULL DEFAULT '[]',
  region_names_json TEXT NOT NULL DEFAULT '[]',
  age_min INTEGER,
  age_max INTEGER,
  income_condition TEXT,
  employment_statuses_json TEXT NOT NULL DEFAULT '[]',
  education_condition TEXT,
  major_condition TEXT,
  marital_condition TEXT,
  special_conditions_json TEXT NOT NULL DEFAULT '[]',
  application_start_date TEXT,
  application_end_date TEXT,
  business_start_date TEXT,
  business_end_date TEXT,
  application_method TEXT,
  application_url TEXT,
  required_documents_json TEXT NOT NULL DEFAULT '[]',
  reference_urls_json TEXT NOT NULL DEFAULT '[]',
  current_status TEXT NOT NULL DEFAULT 'active',
  source_updated_at TEXT,
  collected_at TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  missing_count INTEGER NOT NULL DEFAULT 0,
  source_hash TEXT NOT NULL,
  source_url TEXT NOT NULL,
  search_text TEXT NOT NULL,
  is_mock INTEGER NOT NULL DEFAULT 0 CHECK (is_mock IN (0, 1)),
  UNIQUE (source, source_policy_id)
);

CREATE INDEX IF NOT EXISTS policies_status_idx ON policies(current_status);
CREATE INDEX IF NOT EXISTS policies_category_idx ON policies(large_category, medium_category);
CREATE INDEX IF NOT EXISTS policies_application_dates_idx
  ON policies(application_start_date, application_end_date);
CREATE INDEX IF NOT EXISTS policies_last_seen_idx ON policies(source, last_seen_at);

CREATE TABLE IF NOT EXISTS policy_conditions (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  condition_type TEXT NOT NULL,
  operator TEXT NOT NULL,
  comparison_value TEXT,
  unit TEXT,
  raw_condition TEXT NOT NULL,
  structured_status TEXT NOT NULL,
  evidence_source TEXT,
  evidence_url TEXT,
  manual_review INTEGER NOT NULL DEFAULT 0 CHECK (manual_review IN (0, 1))
);

CREATE INDEX IF NOT EXISTS policy_conditions_policy_idx
  ON policy_conditions(policy_id, condition_type);

CREATE TABLE IF NOT EXISTS policy_versions (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT,
  normalized_data_json TEXT NOT NULL,
  raw_response_json TEXT NOT NULL,
  diff_json TEXT NOT NULL DEFAULT '[]',
  source_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (policy_id, version)
);

CREATE INDEX IF NOT EXISTS policy_versions_as_of_idx
  ON policy_versions(policy_id, valid_from, valid_to);

CREATE TABLE IF NOT EXISTS policy_evidence (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  field_path TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  evidence_text TEXT,
  effective_date TEXT,
  verified_at TEXT NOT NULL,
  confidence TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  conflict_note TEXT
);

CREATE INDEX IF NOT EXISTS policy_evidence_policy_idx
  ON policy_evidence(policy_id, field_path);

CREATE TABLE IF NOT EXISTS policy_legal_bases (
  id TEXT PRIMARY KEY,
  policy_id TEXT NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
  legal_id TEXT,
  legal_name TEXT NOT NULL,
  article TEXT,
  effective_date TEXT,
  promulgation_date TEXT,
  responsible_agency TEXT,
  source_url TEXT NOT NULL,
  link_method TEXT NOT NULL,
  confidence TEXT NOT NULL,
  verified_at TEXT NOT NULL,
  manual_review INTEGER NOT NULL DEFAULT 0 CHECK (manual_review IN (0, 1))
);

CREATE INDEX IF NOT EXISTS policy_legal_bases_policy_idx
  ON policy_legal_bases(policy_id);

CREATE TABLE IF NOT EXISTS sync_runs (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  success INTEGER CHECK (success IN (0, 1)),
  status TEXT NOT NULL,
  fetched_count INTEGER NOT NULL DEFAULT 0,
  new_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  unchanged_count INTEGER NOT NULL DEFAULT 0,
  inactive_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS sync_runs_source_started_idx
  ON sync_runs(source, started_at DESC);
