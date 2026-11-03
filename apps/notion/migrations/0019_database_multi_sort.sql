ALTER TABLE database_views
  ADD COLUMN sort_by_2 TEXT NOT NULL DEFAULT 'none'
  CHECK(sort_by_2 IN ('none','due_date','title','status','priority','assignee'));
