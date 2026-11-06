ALTER TABLE database_views ADD COLUMN position INTEGER NOT NULL DEFAULT 0;

UPDATE database_views
SET position = (
  SELECT COUNT(*)
  FROM database_views AS earlier
  WHERE earlier.database_id = database_views.database_id
    AND (earlier.created_at < database_views.created_at
      OR (earlier.created_at = database_views.created_at AND earlier.id < database_views.id))
);

CREATE INDEX IF NOT EXISTS database_views_position
  ON database_views(database_id, position, created_at);
