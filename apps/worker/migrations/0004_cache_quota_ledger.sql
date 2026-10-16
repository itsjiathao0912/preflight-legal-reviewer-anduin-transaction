-- Phase 04b migration 0004: global AI cache, quota counters and spend ledger (3 tables).
-- No foreign keys to workspaces, so the retention purge can never delete spend history.

CREATE TABLE ai_cache (
  key TEXT NOT NULL PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('ai','ocr','counsel_draft')),
  model TEXT NOT NULL,
  input_hash TEXT,
  prompt_version TEXT,
  schema_version TEXT,
  firm_rules_hash TEXT,
  result_json TEXT NOT NULL CHECK (length(result_json) <= 1500000),
  bytes INTEGER NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
) WITHOUT ROWID;
CREATE INDEX ix_cache_exp ON ai_cache(expires_at);

CREATE TABLE quota_counter (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  window TEXT NOT NULL,
  count INTEGER NOT NULL CHECK (count >= 0),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (scope, key, window)
) WITHOUT ROWID;

CREATE TABLE spend_ledger (
  id TEXT NOT NULL PRIMARY KEY,
  at INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('llm','ocr')),
  model TEXT NOT NULL,
  units INTEGER NOT NULL DEFAULT 0,
  cache TEXT NOT NULL DEFAULT 'miss' CHECK (cache IN ('hit','miss')),
  tokens_in INTEGER,
  tokens_out INTEGER,
  cost_micro_usd INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('ok','failed','refunded')),
  cache_key TEXT,
  visitor_hash TEXT
) WITHOUT ROWID;
CREATE INDEX ix_spend_at ON spend_ledger(at);

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '4', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
