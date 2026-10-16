-- Phase 04b migration 0005 (review L3, fix cycle 1): the missing demo-write-block triggers.
-- Defense in depth only (no app path writes ws_demo): UPDATE of demo rows outside seed mode, and
-- any DELETE of demo rows (the retention purge only ever deletes kind='sandbox' workspaces).
-- Forward-only: 0002 is not edited after remote apply.

CREATE TRIGGER demo_ro_review_run_update BEFORE UPDATE ON review_run
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_answer_update BEFORE UPDATE ON counsel_answer
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_fund_update BEFORE UPDATE ON fund
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_document_update BEFORE UPDATE ON document
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_analyst_update BEFORE UPDATE ON analyst
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

CREATE TRIGGER demo_ro_firm_rule_delete BEFORE DELETE ON firm_rule
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_rule_evidence_delete BEFORE DELETE ON rule_evidence
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_analyst_delete BEFORE DELETE ON analyst
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_fund_delete BEFORE DELETE ON fund
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_document_delete BEFORE DELETE ON document
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_review_run_delete BEFORE DELETE ON review_run
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_finding_delete BEFORE DELETE ON finding
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_finding_state_delete BEFORE DELETE ON finding_state
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_question_delete BEFORE DELETE ON counsel_question
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '5', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
