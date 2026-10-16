// Document metadata repository (no bytes, no text). Deterministic id per (workspace, fund, hash).
import { sha256Hex } from '@aduin/core';
import type { Db } from '../../db/meta';

export const DOCUMENT_SQL = {
  upsert:
    'INSERT INTO document (workspace_id, id, fund_id, law_firm_id, display_name, content_hash, version_label, ' +
    "source, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'upload', ?8) ON CONFLICT DO NOTHING",
} as const;

export function documentId(workspaceId: string, fundId: string, contentHash: string): string {
  return `do_${sha256Hex(`doc|${workspaceId}|${fundId}|${contentHash}`).slice(0, 22)}`;
}

export function documentUpsertStmt(
  db: Db,
  p: {
    workspaceId: string;
    fundId: string;
    firm: string | null;
    displayName: string;
    contentHash: string;
    versionLabel: string | null;
    now: number;
  },
): { stmt: D1PreparedStatement; id: string } {
  const id = documentId(p.workspaceId, p.fundId, p.contentHash);
  return {
    id,
    stmt: db
      .prepare(DOCUMENT_SQL.upsert)
      .bind(
        p.workspaceId,
        id,
        p.fundId,
        p.firm,
        p.displayName,
        p.contentHash,
        p.versionLabel,
        p.now,
      ),
  };
}
