ALTER TABLE database_views ADD COLUMN group_by TEXT NOT NULL DEFAULT 'none' CHECK(group_by IN ('none','status'));
