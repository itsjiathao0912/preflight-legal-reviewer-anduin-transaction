// Fund repository. Ids are deterministic per (workspace, firm, normalized name), so a re-sent
// run creation is idempotent without a read-before-write.
import { normalize, sha256Hex } from '@aduin/core';
import type { Db } from '../../db/meta';

export const FUND_SQL = {
  upsert:
    'INSERT INTO fund (workspace_id, id, law_firm_id, name, name_norm, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ' +
    'ON CONFLICT DO NOTHING',
} as const;

export const NO_FUND = '(no fund)';

export function fundId(workspaceId: string, firm: string | null, nameNorm: string): string {
  return `fu_${sha256Hex(`fund|${workspaceId}|${firm ?? ''}|${nameNorm}`).slice(0, 22)}`;
}

export function fundUpsertStmt(
  db: Db,
  p: { workspaceId: string; firm: string | null; name: string; now: number },
): { stmt: D1PreparedStatement; id: string } {
  const norm = normalize(p.name);
  const id = fundId(p.workspaceId, p.firm, norm);
  return {
    id,
    stmt: db.prepare(FUND_SQL.upsert).bind(p.workspaceId, id, p.firm, p.name, norm, p.now),
  };
}
