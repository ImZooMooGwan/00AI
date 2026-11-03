CREATE TABLE IF NOT EXISTS template_ratings (
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
  updated_at TEXT NOT NULL,
  PRIMARY KEY(template_id,user_id)
);
CREATE INDEX IF NOT EXISTS template_ratings_lookup ON template_ratings(template_id,rating);
