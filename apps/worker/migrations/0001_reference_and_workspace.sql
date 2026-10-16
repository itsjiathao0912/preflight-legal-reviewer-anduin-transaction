-- Phase 04b migration 0001: reference tables, workspaces and run metadata (9 tables).
-- Forward-only. Timestamps are INTEGER epoch milliseconds UTC. Workspace-scoped tables use
-- PRIMARY KEY (workspace_id, ...) WITHOUT ROWID; child links are composite foreign keys.

CREATE TABLE app_meta (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE law_firm (
  id TEXT NOT NULL PRIMARY KEY,
  canonical_name TEXT NOT NULL,
  name_norm TEXT NOT NULL UNIQUE
) WITHOUT ROWID;

CREATE TABLE law_firm_alias (
  alias_norm TEXT NOT NULL PRIMARY KEY,
  law_firm_id TEXT NOT NULL REFERENCES law_firm(id)
) WITHOUT ROWID;
CREATE INDEX ix_alias_firm ON law_firm_alias(law_firm_id);

CREATE TABLE issue_class (
  code TEXT NOT NULL PRIMARY KEY,
  label TEXT NOT NULL,
  sort INTEGER NOT NULL
) WITHOUT ROWID;

CREATE TABLE workspace (
  id TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('demo','sandbox')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','purging')),
  seed_version INTEGER,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL,
  expires_at INTEGER,
  CHECK ((kind = 'demo') = (expires_at IS NULL)),
  CHECK (kind = 'sandbox' OR status = 'active')
) WITHOUT ROWID;
CREATE INDEX ix_ws_expiry ON workspace(expires_at) WHERE kind = 'sandbox';

CREATE TABLE analyst (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  is_seed INTEGER NOT NULL DEFAULT 0 CHECK (is_seed IN (0,1)),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE fund (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  law_firm_id TEXT REFERENCES law_firm(id),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  name_norm TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id)
) WITHOUT ROWID;
CREATE UNIQUE INDEX uq_fund ON fund(workspace_id, IFNULL(law_firm_id, ''), name_norm);

CREATE TABLE document (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  fund_id TEXT NOT NULL,
  law_firm_id TEXT REFERENCES law_firm(id),
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 120),
  format TEXT CHECK (format IS NULL OR format IN ('html','pdf','docx','scan_pdf','image')),
  content_hash TEXT NOT NULL CHECK (length(content_hash) = 64),
  size_bytes INTEGER,
  page_count INTEGER,
  version_label TEXT CHECK (version_label IS NULL OR length(version_label) <= 120),
  source TEXT NOT NULL DEFAULT 'upload' CHECK (source IN ('upload','sample')),
  sample_id TEXT,
  upload_started_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, fund_id, content_hash),
  FOREIGN KEY (workspace_id, fund_id) REFERENCES fund(workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE review_run (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  law_firm_id TEXT REFERENCES law_firm(id),
  engine_version TEXT NOT NULL,
  settings_hash TEXT NOT NULL CHECK (length(settings_hash) = 64),
  prompt_version TEXT NOT NULL DEFAULT 'none',
  schema_version TEXT NOT NULL DEFAULT '1',
  fp_version INTEGER NOT NULL DEFAULT 1,
  firm_rules_hash TEXT NOT NULL,
  memory_mode TEXT NOT NULL CHECK (memory_mode IN ('applied','no_firm','unavailable')),
  ai_mode TEXT NOT NULL DEFAULT 'off' CHECK (ai_mode IN ('off','full','degraded')),
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','det_done','complete','partial','failed')),
  stage_failed TEXT,
  findings_total INTEGER NOT NULL DEFAULT 0,
  blocking_total INTEGER NOT NULL DEFAULT 0,
  first_exportable_at INTEGER,
  sheet_exported_at INTEGER,
  sheet_question_count INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, document_id, settings_hash, firm_rules_hash),
  FOREIGN KEY (workspace_id, document_id) REFERENCES document(workspace_id, id)
) WITHOUT ROWID;
CREATE INDEX ix_run_doc ON review_run(workspace_id, document_id, created_at DESC);

INSERT INTO app_meta (key, value, updated_at) VALUES ('seed_mode', '0', 0);
INSERT INTO app_meta (key, value, updated_at) VALUES ('last_purge_at', '0', 0);
INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '1', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
