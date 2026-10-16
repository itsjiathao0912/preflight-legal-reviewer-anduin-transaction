// D1 LedgerPort over `spend_ledger` (global; no FK to workspaces, so purges never delete spend
// history). cost_usd is stored as integer micro-USD.
import type { LedgerPort } from '@aduin/core';
import { newId } from '../db/ids';
import type { Db } from '../db/meta';

export const LEDGER_SQL = {
  record:
    'INSERT INTO spend_ledger (id, at, kind, model, units, cache, cost_micro_usd, outcome) ' +
    "VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'ok')",
} as const;

export function toMicroUsd(costUsd: number | undefined): number {
  if (costUsd === undefined || !Number.isFinite(costUsd) || costUsd <= 0) return 0;
  return Math.round(costUsd * 1_000_000);
}

export function createD1Ledger(db: Db): LedgerPort {
  return {
    async record(entry) {
      await db
        .prepare(LEDGER_SQL.record)
        .bind(
          newId('sl', entry.at),
          entry.at,
          entry.kind,
          entry.model.slice(0, 120),
          Math.max(0, Math.floor(entry.units)),
          entry.cache,
          toMicroUsd(entry.cost_usd),
        )
        .run();
    },
  };
}
