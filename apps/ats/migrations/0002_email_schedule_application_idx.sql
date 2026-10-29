CREATE INDEX IF NOT EXISTS email_schedules_application_idx
  ON email_schedules(application_id, created_at DESC);
