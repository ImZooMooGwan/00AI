ALTER TABLE database_views
  ADD COLUMN sort_by_field TEXT NOT NULL DEFAULT 'manual'
  CHECK(sort_by_field IN ('manual','due_date','title','status','priority','assignee'));

UPDATE database_views SET sort_by_field = sort_by;
