-- Expand database layouts without changing existing row or view data.
ALTER TABLE databases ADD COLUMN layout_type TEXT;
ALTER TABLE database_views ADD COLUMN layout_type TEXT;
