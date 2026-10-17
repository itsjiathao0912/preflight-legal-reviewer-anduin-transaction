-- Variance MVP Phase 03 migration 0006: question owner, answer/decision intent and scope, the
-- append-only regression_check table and three reference firms. Forward-only and additive: every
-- new column is nullable, so an older Worker (and a code rollback) keeps working on this schema.
-- Landed migrations 0001-0005 are never edited; the two guard triggers below are DROPPED and
-- RECREATED with the 0002 text verbatim plus the new columns (immutable after insert).

ALTER TABLE counsel_question ADD COLUMN owner TEXT
  CHECK (owner IS NULL OR owner IN ('counsel','gp','fund_admin'));
ALTER TABLE counsel_question ADD COLUMN owner_source TEXT
  CHECK (owner_source IS NULL OR owner_source IN ('suggested','override'));
ALTER TABLE counsel_answer ADD COLUMN intent TEXT
  CHECK (intent IS NULL OR length(intent) <= 500);
ALTER TABLE counsel_answer ADD COLUMN scope TEXT
  CHECK (scope IS NULL OR scope IN ('fund','firm_template'));
ALTER TABLE decision ADD COLUMN intent TEXT
  CHECK (intent IS NULL OR length(intent) <= 500);
ALTER TABLE decision ADD COLUMN scope TEXT
  CHECK (scope IS NULL OR scope IN ('fund','firm_template'));

DROP TRIGGER decision_guard_update;
CREATE TRIGGER decision_guard_update BEFORE UPDATE ON decision
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging' AND (
     NEW.workspace_id IS NOT OLD.workspace_id OR NEW.id IS NOT OLD.id
  OR NEW.law_firm_id IS NOT OLD.law_firm_id OR NEW.fingerprint IS NOT OLD.fingerprint
  OR NEW.fp_version IS NOT OLD.fp_version OR NEW.issue_class IS NOT OLD.issue_class
  OR NEW.pattern_key IS NOT OLD.pattern_key OR NEW.quote_hash IS NOT OLD.quote_hash
  OR NEW.quote_snippet IS NOT OLD.quote_snippet OR NEW.section_path IS NOT OLD.section_path
  OR NEW.fund_name IS NOT OLD.fund_name OR NEW.doc_version_label IS NOT OLD.doc_version_label
  OR NEW.origin_fund_id IS NOT OLD.origin_fund_id
  OR NEW.origin_document_id IS NOT OLD.origin_document_id
  OR NEW.origin_review_run_id IS NOT OLD.origin_review_run_id
  OR NEW.origin_finding_key IS NOT OLD.origin_finding_key
  OR NEW.decision IS NOT OLD.decision OR NEW.reason_code IS NOT OLD.reason_code
  OR NEW.note IS NOT OLD.note OR NEW.counsel_option IS NOT OLD.counsel_option
  OR NEW.counsel_note IS NOT OLD.counsel_note OR NEW.counsel_answer_id IS NOT OLD.counsel_answer_id
  OR NEW.decided_by_analyst_id IS NOT OLD.decided_by_analyst_id
  OR NEW.decided_by_name IS NOT OLD.decided_by_name OR NEW.decided_at IS NOT OLD.decided_at
  OR NEW.supersedes_id IS NOT OLD.supersedes_id OR NEW.seed_of IS NOT OLD.seed_of
  OR NEW.intent IS NOT OLD.intent OR NEW.scope IS NOT OLD.scope
  OR NOT (OLD.status = 'active' AND NEW.status IN ('superseded','revoked'))
  OR (NEW.status = 'superseded' AND (NEW.revoked_at IS NOT NULL OR NEW.revoke_reason IS NOT NULL))
  OR (NEW.status = 'revoked' AND NEW.superseded_by_id IS NOT NULL)
)
BEGIN SELECT RAISE(ABORT, 'decision_immutable'); END;

DROP TRIGGER answer_guard_update;
CREATE TRIGGER answer_guard_update BEFORE UPDATE ON counsel_answer
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.id IS NOT OLD.id
  OR NEW.question_id IS NOT OLD.question_id OR NEW.option IS NOT OLD.option
  OR NEW.note IS NOT OLD.note OR NEW.answered_by_name IS NOT OLD.answered_by_name
  OR NEW.answered_at IS NOT OLD.answered_at
  OR NEW.intent IS NOT OLD.intent OR NEW.scope IS NOT OLD.scope
  OR NOT (OLD.status = 'active' AND NEW.status = 'revoked')
BEGIN SELECT RAISE(ABORT, 'answer_immutable'); END;

-- SQLite fires the most recently created trigger first. Recreating the two guards above would
-- put them ahead of the demo update blocks, so a demo-row UPDATE would report the guard text
-- instead of demo_read_only. The two demo triggers are recreated verbatim (0002 and 0005 text) to keep the
-- prior precedence exactly.
DROP TRIGGER demo_ro_decision_update;
CREATE TRIGGER demo_ro_decision_update BEFORE UPDATE ON decision
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
DROP TRIGGER demo_ro_counsel_answer_update;
CREATE TRIGGER demo_ro_counsel_answer_update BEFORE UPDATE ON counsel_answer
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

-- No counsel_question guard existed before 0006; owner/owner_source are written once at INSERT.
CREATE TRIGGER question_owner_immutable BEFORE UPDATE ON counsel_question
WHEN NEW.owner IS NOT OLD.owner OR NEW.owner_source IS NOT OLD.owner_source
BEGIN SELECT RAISE(ABORT, 'question_owner_immutable'); END;

CREATE TABLE regression_check (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  law_firm_id TEXT NOT NULL REFERENCES law_firm(id),
  source_answer_id TEXT NOT NULL,
  source_fund_name TEXT NOT NULL CHECK (length(source_fund_name) <= 200),
  assertion_kind TEXT NOT NULL CHECK (assertion_kind = 'scope_exists'),
  assertion_key TEXT NOT NULL CHECK (length(assertion_key) BETWEEN 1 AND 80),
  statement_text TEXT NOT NULL CHECK (length(statement_text) BETWEEN 1 AND 300),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, source_answer_id) REFERENCES counsel_answer(workspace_id, id)
) WITHOUT ROWID;
CREATE INDEX ix_regression_check_scope ON regression_check(workspace_id, law_firm_id, status);

CREATE TRIGGER regression_check_no_delete BEFORE DELETE ON regression_check
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging'
BEGIN SELECT RAISE(ABORT, 'regression_check_append_only'); END;

CREATE TRIGGER regression_check_guard_update BEFORE UPDATE ON regression_check
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.id IS NOT OLD.id
  OR NEW.law_firm_id IS NOT OLD.law_firm_id OR NEW.source_answer_id IS NOT OLD.source_answer_id
  OR NEW.source_fund_name IS NOT OLD.source_fund_name
  OR NEW.assertion_kind IS NOT OLD.assertion_kind OR NEW.assertion_key IS NOT OLD.assertion_key
  OR NEW.statement_text IS NOT OLD.statement_text OR NEW.created_at IS NOT OLD.created_at
  OR NOT (OLD.status = 'active' AND NEW.status = 'revoked')
BEGIN SELECT RAISE(ABORT, 'regression_check_immutable'); END;

-- Backstop of the route pre-check; the literal equals core limits.regressionChecksPerFirm and the
-- variance rules config regression.max_checks_per_firm (parity asserted in a worker test).
CREATE TRIGGER regression_check_cap BEFORE INSERT ON regression_check
WHEN NEW.status = 'active' AND (
  SELECT COUNT(*) FROM regression_check
  WHERE workspace_id = NEW.workspace_id AND law_firm_id = NEW.law_firm_id AND status = 'active'
) >= 20
BEGIN SELECT RAISE(ABORT, 'regression_check_cap'); END;

CREATE TRIGGER demo_ro_regression_check BEFORE INSERT ON regression_check
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_regression_check_update BEFORE UPDATE ON regression_check
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_regression_check_delete BEFORE DELETE ON regression_check
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

INSERT OR IGNORE INTO law_firm (id, canonical_name, name_norm) VALUES ('hartwell-crane', 'Hartwell & Crane LLP', 'hartwell and crane');
INSERT OR IGNORE INTO law_firm (id, canonical_name, name_norm) VALUES ('ostrander-pell', 'Ostrander Pell LLP', 'ostrander pell');
INSERT OR IGNORE INTO law_firm (id, canonical_name, name_norm) VALUES ('calder-reyes', 'Calder Reyes', 'calder reyes');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('hartwell and crane', 'hartwell-crane');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('hartwell crane', 'hartwell-crane');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('hc', 'hartwell-crane');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('h and c', 'hartwell-crane');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('ostrander pell', 'ostrander-pell');
INSERT OR IGNORE INTO law_firm_alias (alias_norm, law_firm_id) VALUES ('calder reyes', 'calder-reyes');

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '6', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
