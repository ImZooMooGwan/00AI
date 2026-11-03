ALTER TABLE databases ADD COLUMN properties_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE database_rows ADD COLUMN custom_values TEXT NOT NULL DEFAULT '{}';
