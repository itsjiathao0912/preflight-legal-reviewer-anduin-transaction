// Direct-SQL fixtures for the Phase 04b schema tests (not a gate file: no `.test.ts` suffix).
import { sha256Hex } from '@aduin/core';

export const DAY_MS = 86_400_000;
let seq = 0;

/** Unique id per call (storage is shared by the tests of one file). */
export function uid(prefix: string): string {
  seq++;
  return `${prefix}${seq.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export const hex64 = (s: string) => sha256Hex(s);

export async function mkWorkspace(
  db: D1Database,
  opts: { id?: string; now?: number; expiresAt?: number; analyst?: string } = {},
): Promise<string> {
  const id = opts.id ?? uid('w_');
  const now = opts.now ?? 1_000;
  await db.batch([
    db
      .prepare(
        "INSERT INTO workspace (id, kind, status, created_at, last_active_at, expires_at) VALUES (?1, 'sandbox', 'active', ?2, ?2, ?3)",
      )
      .bind(id, now, opts.expiresAt ?? now + 30 * DAY_MS),
    db
      .prepare(
        'INSERT INTO analyst (workspace_id, id, display_name, is_seed, created_at) VALUES (?1, ?2, ?3, 0, ?4)',
      )
      .bind(id, 'an1', opts.analyst ?? 'Tester', now),
  ]);
  return id;
}

export interface DecisionRow {
  workspace_id: string;
  id: string;
  law_firm_id: string;
  fingerprint: string;
  issue_class: string;
  pattern_key: string | null;
  quote_hash: string;
  quote_snippet: string;
  fund_name: string;
  decision: 'accepted' | 'dismissed' | 'answered';
  reason_code: string | null;
  counsel_option: string | null;
  decided_by_name: string;
  decided_at: number;
  status: 'active' | 'superseded' | 'revoked';
}

export function decisionRow(ws: string, over: Partial<DecisionRow> = {}): DecisionRow {
  const id = over.id ?? uid('dc_');
  return {
    workspace_id: ws,
    id,
    law_firm_id: 'firm-x',
    fingerprint: hex64(`fp-${id}`),
    issue_class: 'ambiguity',
    pattern_key: null,
    quote_hash: hex64(`qh-${id}`),
    quote_snippet: 'A snippet.',
    fund_name: 'Fund',
    decision: 'accepted',
    reason_code: null,
    counsel_option: null,
    decided_by_name: 'Tester',
    decided_at: 1_000,
    status: 'active',
    ...over,
  };
}

const DECISION_COLS = [
  'workspace_id',
  'id',
  'law_firm_id',
  'fingerprint',
  'issue_class',
  'pattern_key',
  'quote_hash',
  'quote_snippet',
  'fund_name',
  'decision',
  'reason_code',
  'counsel_option',
  'decided_by_name',
  'decided_at',
  'status',
] as const;

export function insertDecisionStmt(db: D1Database, row: DecisionRow): D1PreparedStatement {
  const ph = DECISION_COLS.map((_, i) => `?${i + 1}`).join(', ');
  return db
    .prepare(`INSERT INTO decision (${DECISION_COLS.join(', ')}) VALUES (${ph})`)
    .bind(...DECISION_COLS.map((c) => row[c]));
}

export async function insertDecision(db: D1Database, row: DecisionRow): Promise<void> {
  await insertDecisionStmt(db, row).run();
}

/** Resolves to the thrown error message ('' when the promise resolved). */
export async function errorOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return '';
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}
