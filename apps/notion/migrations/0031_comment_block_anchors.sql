ALTER TABLE comments ADD COLUMN block_id TEXT;
CREATE INDEX IF NOT EXISTS comments_by_block ON comments(page_id,block_id,created_at);
