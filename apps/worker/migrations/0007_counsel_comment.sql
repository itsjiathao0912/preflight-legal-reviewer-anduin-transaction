-- Counsel share link migration 0007: per-question comments written by the analyst or by outside
-- counsel (through the signed share link). Append-only: rows are never updated, and are deleted
-- only while the owning workspace is 'purging' (the retention purge). Demo workspace rows are
-- blocked like every other memory table. Forward-only and additive (one new table, no column
-- change), but the schema_version bump 6 -> 7 makes Workers that pin '6' refuse memory writes.

CREATE TABLE counsel_comment (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('analyst','counsel')),
  author_name TEXT NOT NULL CHECK (length(author_name) BETWEEN 1 AND 120),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 1000),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, question_id) REFERENCES counsel_question(workspace_id, id)
) WITHOUT ROWID;
CREATE INDEX ix_comment_q ON counsel_comment(workspace_id, question_id, created_at);

CREATE TRIGGER comment_no_update BEFORE UPDATE ON counsel_comment
BEGIN SELECT RAISE(ABORT, 'comment_append_only'); END;

CREATE TRIGGER comment_no_delete BEFORE DELETE ON counsel_comment
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging'
BEGIN SELECT RAISE(ABORT, 'comment_append_only'); END;

-- Backstop of the route pre-check (50 comments per question).
CREATE TRIGGER comment_cap BEFORE INSERT ON counsel_comment
WHEN (
  SELECT COUNT(*) FROM counsel_comment
  WHERE workspace_id = NEW.workspace_id AND question_id = NEW.question_id
) >= 50
BEGIN SELECT RAISE(ABORT, 'comment_cap'); END;

CREATE TRIGGER demo_ro_counsel_comment BEFORE INSERT ON counsel_comment
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_comment_delete BEFORE DELETE ON counsel_comment
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '7', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
