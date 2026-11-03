ALTER TABLE pages ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

UPDATE pages AS page
SET sort_order = (
  SELECT COUNT(*)
  FROM pages AS sibling
  WHERE sibling.workspace_id = page.workspace_id
    AND sibling.parent_id IS page.parent_id
    AND sibling.archived_at IS NULL
    AND (
      sibling.updated_at > page.updated_at
      OR (sibling.updated_at = page.updated_at AND sibling.id < page.id)
    )
);

CREATE INDEX IF NOT EXISTS pages_sibling_order
  ON pages(workspace_id, parent_id, archived_at, sort_order);
