ALTER TABLE database_views
  ADD COLUMN group_by_field TEXT NOT NULL DEFAULT 'none'
  CHECK(group_by_field IN ('none','status','priority','assignee'));

UPDATE database_views SET group_by_field = group_by;
