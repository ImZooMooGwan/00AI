ALTER TABLE databases ADD COLUMN calendar_view INTEGER NOT NULL DEFAULT 0 CHECK(calendar_view IN (0,1));
