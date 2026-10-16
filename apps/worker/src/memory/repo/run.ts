// Review-run repository. Run ids are deterministic per (workspace, document, settings, rules hash):
// re-running the same inputs is idempotent and AI findings append to the same run.
import { sha256Hex } from '@aduin/core';
import type { Db } from '../../db/meta';
import type { MemoryCtx } from '../ctx';

export const RUN_SQL = {
  upsert:
    'INSERT INTO review_run (workspace_id, id, document_id, law_firm_id, engine_version, settings_hash, ' +
    'firm_rules_hash, memory_mode, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9) ON CONFLICT DO NOTHING',
  context:
    'SELECT r.id, r.law_firm_id, r.document_id, d.fund_id, f.name AS fund_name, d.version_label ' +
    'FROM review_run r JOIN document d ON d.workspace_id = r.workspace_id AND d.id = r.document_id ' +
    'JOIN fund f ON f.workspace_id = d.workspace_id AND f.id = d.fund_id WHERE r.workspace_id = ?1 AND r.id = ?2',
  markExported:
    'UPDATE review_run SET sheet_exported_at = ?3, sheet_question_count = ?4 WHERE workspace_id = ?1 AND id = ?2',
  latestWithFinding:
    'SELECT f.review_run_id AS id, f.issue_class FROM finding f JOIN review_run r ON r.workspace_id = f.workspace_id ' +
    'AND r.id = f.review_run_id WHERE f.workspace_id = ?1 AND f.finding_key = ?2 ORDER BY r.created_at DESC LIMIT 1',
  latestByDecisionOrigin:
    'SELECT origin_review_run_id AS id FROM decision WHERE workspace_id = ?1 AND origin_finding_key = ?2 ' +
    'AND origin_review_run_id IS NOT NULL ORDER BY decided_at DESC LIMIT 1',
  latest:
    'SELECT id FROM review_run WHERE workspace_id = ?1 ORDER BY created_at DESC, id DESC LIMIT 1',
} as const;

export const ENGINE_VERSION = 'web-1';

export function runId(
  workspaceId: string,
  documentId: string,
  settingsHash: string,
  rulesHash: string,
): string {
  return `ru_${sha256Hex(`run|${workspaceId}|${documentId}|${settingsHash}|${rulesHash}`).slice(0, 22)}`;
}

export function runUpsertStmt(
  db: Db,
  p: {
    workspaceId: string;
    documentId: string;
    firm: string | null;
    settingsHash: string;
    rulesHash: string;
    now: number;
  },
): { stmt: D1PreparedStatement; id: string } {
  const id = runId(p.workspaceId, p.documentId, p.settingsHash, p.rulesHash);
  return {
    id,
    stmt: db
      .prepare(RUN_SQL.upsert)
      .bind(
        p.workspaceId,
        id,
        p.documentId,
        p.firm,
        ENGINE_VERSION,
        p.settingsHash,
        p.rulesHash,
        p.firm ? 'applied' : 'no_firm',
        p.now,
      ),
  };
}

export interface RunContext {
  id: string;
  law_firm_id: string | null;
  document_id: string;
  fund_id: string;
  fund_name: string;
  version_label: string | null;
}

export async function runContext(ctx: MemoryCtx, runId: string): Promise<RunContext | null> {
  return ctx.db.prepare(RUN_SQL.context).bind(ctx.workspaceId, runId).first<RunContext>();
}
