-- Phase 04b migration 0002: Review Memory core (8 tables) plus append-only, transition and
-- demo-write-block triggers. Deletes of append-only rows are allowed ONLY while the owning
-- workspace has status 'purging' (the retention purge is the only delete path).
-- finding_state and counsel_question reference review_run (finding_key is a plain column) so
-- the best-effort `finding` tier never breaks the essential writes.

CREATE TABLE counsel_question (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  review_run_id TEXT NOT NULL,
  finding_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  law_firm_id TEXT NOT NULL REFERENCES law_firm(id),
  issue_class TEXT NOT NULL REFERENCES issue_class(code),
  draft_text TEXT CHECK (draft_text IS NULL OR length(draft_text) <= 2000),
  edited_text TEXT CHECK (edited_text IS NULL OR length(edited_text) <= 2000),
  interpretations_json TEXT NOT NULL CHECK (length(interpretations_json) <= 4000),
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'drafted' CHECK (status IN ('drafted','exported','answered')),
  exported_at INTEGER,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, review_run_id, finding_key),
  FOREIGN KEY (workspace_id, review_run_id) REFERENCES review_run(workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE counsel_answer (
  workspace_id TEXT NOT NULL,
  id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  option TEXT NOT NULL CHECK (option IN ('A','B','C','unclear')),
  note TEXT CHECK (note IS NULL OR length(note) <= 1000),
  answered_by_name TEXT NOT NULL,
  answered_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','revoked')),
  revoked_at INTEGER,
  revoke_reason TEXT,
  PRIMARY KEY (workspace_id, id),
  FOREIGN KEY (workspace_id, question_id) REFERENCES counsel_question(workspace_id, id),
  CHECK (status <> 'revoked' OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL))
) WITHOUT ROWID;
CREATE INDEX ix_answer_q ON counsel_answer(workspace_id, question_id, answered_at DESC);

CREATE TABLE decision (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  law_firm_id TEXT NOT NULL REFERENCES law_firm(id),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  fp_version INTEGER NOT NULL DEFAULT 1,
  issue_class TEXT NOT NULL REFERENCES issue_class(code),
  pattern_key TEXT CHECK (pattern_key IS NULL OR length(pattern_key) BETWEEN 1 AND 80),
  quote_hash TEXT NOT NULL CHECK (length(quote_hash) = 64),
  quote_snippet TEXT NOT NULL CHECK (length(quote_snippet) <= 300),
  section_path TEXT CHECK (section_path IS NULL OR length(section_path) <= 2500),
  fund_name TEXT NOT NULL CHECK (length(fund_name) BETWEEN 1 AND 200),
  doc_version_label TEXT CHECK (doc_version_label IS NULL OR length(doc_version_label) <= 120),
  origin_fund_id TEXT,
  origin_document_id TEXT,
  origin_review_run_id TEXT,
  origin_finding_key TEXT,
  decision TEXT NOT NULL CHECK (decision IN ('accepted','dismissed','answered')),
  reason_code TEXT CHECK (reason_code IN
    ('firm_standard_wording','no_form_impact','tool_false_alarm','other')),
  note TEXT CHECK (length(note) <= 500),
  counsel_option TEXT CHECK (counsel_option IN ('A','B','C','unclear')),
  counsel_note TEXT CHECK (length(counsel_note) <= 1000),
  counsel_answer_id TEXT,
  decided_by_analyst_id TEXT,
  decided_by_name TEXT NOT NULL CHECK (length(decided_by_name) BETWEEN 1 AND 120),
  decided_at INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','superseded','revoked')),
  supersedes_id TEXT,
  superseded_by_id TEXT,
  revoked_by_name TEXT,
  revoked_at INTEGER,
  revoke_reason TEXT CHECK (revoke_reason IS NULL OR length(revoke_reason) <= 500),
  seed_of TEXT,
  PRIMARY KEY (workspace_id, id),
  CHECK (decision <> 'dismissed' OR reason_code IS NOT NULL),
  CHECK (decision <> 'answered' OR counsel_option IS NOT NULL),
  CHECK (status <> 'revoked' OR (revoked_at IS NOT NULL AND revoke_reason IS NOT NULL)),
  FOREIGN KEY (workspace_id, supersedes_id) REFERENCES decision(workspace_id, id),
  FOREIGN KEY (workspace_id, counsel_answer_id) REFERENCES counsel_answer(workspace_id, id),
  FOREIGN KEY (workspace_id, decided_by_analyst_id) REFERENCES analyst(workspace_id, id)
) WITHOUT ROWID;

-- at most ONE active decision per workspace+firm+fingerprint; also the lookup index
CREATE UNIQUE INDEX uq_decision_active
  ON decision(workspace_id, law_firm_id, fingerprint) WHERE status = 'active';
-- memory page (filter by issue class, newest first)
CREATE INDEX ix_decision_page
  ON decision(workspace_id, law_firm_id, issue_class, decided_at DESC);
-- rule-proposal counting
CREATE INDEX ix_decision_pattern
  ON decision(workspace_id, law_firm_id, pattern_key, reason_code)
  WHERE decision = 'dismissed' AND status = 'active';

CREATE TABLE finding (
  workspace_id TEXT NOT NULL,
  review_run_id TEXT NOT NULL,
  finding_key TEXT NOT NULL,
  issue_class TEXT NOT NULL REFERENCES issue_class(code),
  pattern_key TEXT CHECK (pattern_key IS NULL OR length(pattern_key) <= 80),
  severity TEXT NOT NULL CHECK (severity IN ('critical','high','medium','low')),
  detector_kind TEXT NOT NULL CHECK (detector_kind IN ('rule','ai')),
  detector_id TEXT NOT NULL,
  model TEXT,
  provenance TEXT CHECK (provenance IS NULL OR provenance IN ('fresh','cache')),
  confidence REAL NOT NULL CHECK (confidence BETWEEN 0 AND 1),
  anchor TEXT NOT NULL CHECK (length(anchor) <= 600),
  section_path TEXT CHECK (section_path IS NULL OR length(section_path) <= 2500),
  page INTEGER,
  region_json TEXT CHECK (region_json IS NULL OR length(region_json) <= 200),
  quote_snippet TEXT NOT NULL CHECK (length(quote_snippet) <= 300),
  quote_hash TEXT NOT NULL CHECK (length(quote_hash) = 64),
  fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64),
  detail_json TEXT CHECK (detail_json IS NULL OR length(detail_json) <= 2000),
  memory_label TEXT NOT NULL CHECK (memory_label IN
    ('new','previously_dismissed','dismissed_reconfirm','already_answered','awaiting_counsel')),
  matched_decision_id TEXT,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, review_run_id, finding_key),
  CHECK ((detector_kind = 'ai') = (model IS NOT NULL)),
  FOREIGN KEY (workspace_id, review_run_id) REFERENCES review_run(workspace_id, id),
  FOREIGN KEY (workspace_id, matched_decision_id) REFERENCES decision(workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE finding_state (
  workspace_id TEXT NOT NULL,
  review_run_id TEXT NOT NULL,
  finding_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open','accepted','dismissed','answered')),
  needs_counsel INTEGER NOT NULL DEFAULT 0 CHECK (needs_counsel IN (0,1)),
  severity_override TEXT,
  text_override TEXT,
  current_decision_id TEXT,
  updated_by_name TEXT NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, review_run_id, finding_key),
  FOREIGN KEY (workspace_id, review_run_id) REFERENCES review_run(workspace_id, id),
  FOREIGN KEY (workspace_id, current_decision_id) REFERENCES decision(workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE firm_rule (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  law_firm_id TEXT NOT NULL REFERENCES law_firm(id),
  origin TEXT NOT NULL CHECK (origin IN ('manual','proposed')),
  status TEXT NOT NULL CHECK (status IN ('proposed','active','rejected','revoked')),
  rule_text TEXT NOT NULL CHECK (length(rule_text) BETWEEN 1 AND 500),
  proposal_key TEXT CHECK (proposal_key IS NULL OR length(proposal_key) <= 120),
  created_by_name TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  decided_by_name TEXT,
  decided_at INTEGER,
  revoked_by_name TEXT,
  revoked_at INTEGER,
  revoke_reason TEXT CHECK (revoke_reason IS NULL OR length(revoke_reason) <= 500),
  seed_of TEXT,
  PRIMARY KEY (workspace_id, id),
  CHECK (origin = 'proposed' OR status IN ('active','revoked')),
  CHECK (status <> 'revoked' OR revoked_at IS NOT NULL)
) WITHOUT ROWID;
-- a key is live at most once (proposed or active); rejected/revoked keys may be re-proposed on
-- NEW evidence (D-5, enforced by the proposal statement)
CREATE UNIQUE INDEX uq_rule_proposal
  ON firm_rule(workspace_id, law_firm_id, proposal_key)
  WHERE proposal_key IS NOT NULL AND status IN ('proposed','active');
CREATE INDEX ix_rule_firm ON firm_rule(workspace_id, law_firm_id, status);

CREATE TABLE rule_evidence (
  workspace_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (workspace_id, rule_id, decision_id),
  FOREIGN KEY (workspace_id, rule_id) REFERENCES firm_rule(workspace_id, id),
  FOREIGN KEY (workspace_id, decision_id) REFERENCES decision(workspace_id, id)
) WITHOUT ROWID;

CREATE TABLE audit_event (
  workspace_id TEXT NOT NULL REFERENCES workspace(id),
  id TEXT NOT NULL,
  client_op_id TEXT NOT NULL CHECK (length(client_op_id) BETWEEN 1 AND 80),
  at INTEGER NOT NULL,
  analyst_id TEXT,
  actor_name TEXT NOT NULL,
  action TEXT NOT NULL,
  law_firm_id TEXT,
  entity_type TEXT,
  entity_id TEXT,
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 500),
  detail_json TEXT CHECK (detail_json IS NULL OR length(detail_json) <= 1000),
  result_json TEXT CHECK (result_json IS NULL OR length(result_json) <= 8000),
  PRIMARY KEY (workspace_id, id),
  UNIQUE (workspace_id, client_op_id)
) WITHOUT ROWID;
CREATE INDEX ix_audit_ws_time ON audit_event(workspace_id, at DESC, id DESC);

-- ---------------------------------------------------------------------------------------------
-- Append-only and transition triggers (purge is the only delete path).
-- ---------------------------------------------------------------------------------------------

CREATE TRIGGER decision_no_delete BEFORE DELETE ON decision
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging'
BEGIN SELECT RAISE(ABORT, 'decision_append_only'); END;

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
  OR NOT (OLD.status = 'active' AND NEW.status IN ('superseded','revoked'))
  OR (NEW.status = 'superseded' AND (NEW.revoked_at IS NOT NULL OR NEW.revoke_reason IS NOT NULL))
  OR (NEW.status = 'revoked' AND NEW.superseded_by_id IS NOT NULL)
)
BEGIN SELECT RAISE(ABORT, 'decision_immutable'); END;

CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_event
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging'
BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;

CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_event
BEGIN SELECT RAISE(ABORT, 'audit_append_only'); END;

CREATE TRIGGER answer_no_delete BEFORE DELETE ON counsel_answer
WHEN (SELECT status FROM workspace WHERE id = OLD.workspace_id) IS NOT 'purging'
BEGIN SELECT RAISE(ABORT, 'answer_append_only'); END;

CREATE TRIGGER answer_guard_update BEFORE UPDATE ON counsel_answer
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.id IS NOT OLD.id
  OR NEW.question_id IS NOT OLD.question_id OR NEW.option IS NOT OLD.option
  OR NEW.note IS NOT OLD.note OR NEW.answered_by_name IS NOT OLD.answered_by_name
  OR NEW.answered_at IS NOT OLD.answered_at
  OR NOT (OLD.status = 'active' AND NEW.status = 'revoked')
BEGIN SELECT RAISE(ABORT, 'answer_immutable'); END;

CREATE TRIGGER rule_guard_update BEFORE UPDATE ON firm_rule
WHEN NEW.workspace_id IS NOT OLD.workspace_id OR NEW.id IS NOT OLD.id
  OR NEW.law_firm_id IS NOT OLD.law_firm_id OR NEW.origin IS NOT OLD.origin
  OR NEW.proposal_key IS NOT OLD.proposal_key OR NEW.created_by_name IS NOT OLD.created_by_name
  OR NEW.created_at IS NOT OLD.created_at OR NEW.seed_of IS NOT OLD.seed_of
  OR (NEW.rule_text IS NOT OLD.rule_text AND OLD.status IS NOT 'proposed')
  OR NOT (
       (OLD.status = 'proposed' AND NEW.status IN ('proposed','active','rejected'))
    OR (OLD.status = 'active' AND NEW.status IN ('active','revoked'))
    OR (OLD.status = NEW.status AND OLD.status IN ('rejected','revoked')
        AND NEW.rule_text IS OLD.rule_text AND NEW.decided_at IS OLD.decided_at
        AND NEW.revoked_at IS OLD.revoked_at)
  )
BEGIN SELECT RAISE(ABORT, 'rule_immutable'); END;

-- ---------------------------------------------------------------------------------------------
-- Demo workspace write block: rows of a kind='demo' workspace are written only in seed mode.
-- ---------------------------------------------------------------------------------------------

CREATE TRIGGER demo_ro_workspace_update BEFORE UPDATE ON workspace
WHEN OLD.kind = 'demo' AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_workspace_delete BEFORE DELETE ON workspace
WHEN OLD.kind = 'demo'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_workspace_insert BEFORE INSERT ON workspace
WHEN NEW.kind = 'demo' AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

CREATE TRIGGER demo_ro_analyst BEFORE INSERT ON analyst
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_fund BEFORE INSERT ON fund
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_document BEFORE INSERT ON document
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_review_run BEFORE INSERT ON review_run
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_decision BEFORE INSERT ON decision
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_decision_update BEFORE UPDATE ON decision
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_finding BEFORE INSERT ON finding
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_finding_state BEFORE INSERT ON finding_state
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_finding_state_update BEFORE UPDATE ON finding_state
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_question BEFORE INSERT ON counsel_question
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_question_update BEFORE UPDATE ON counsel_question
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_counsel_answer BEFORE INSERT ON counsel_answer
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_firm_rule BEFORE INSERT ON firm_rule
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_firm_rule_update BEFORE UPDATE ON firm_rule
WHEN (SELECT kind FROM workspace WHERE id = OLD.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_rule_evidence BEFORE INSERT ON rule_evidence
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;
CREATE TRIGGER demo_ro_audit BEFORE INSERT ON audit_event
WHEN (SELECT kind FROM workspace WHERE id = NEW.workspace_id) = 'demo'
  AND (SELECT value FROM app_meta WHERE key = 'seed_mode') IS NOT '1'
BEGIN SELECT RAISE(ABORT, 'demo_read_only'); END;

INSERT INTO app_meta (key, value, updated_at) VALUES ('schema_version', '2', 0)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value;
