import { MemoryApiError } from '../../api/memoryApi';

/**
 * Outcome of one awaited memory write from the memory page (G4: never outbox-queued; each call
 * carries a fresh `client_op_id` generated inside the Phase 08 client, so "Try again" is a new op).
 */
export type WriteOutcome =
  | { kind: 'ok' }
  /** 409 conflict, or 400 rule_state / *_not_found: refetch, close, toast "Already changed". */
  | { kind: 'changed' }
  /** 403 read_only_demo: writes are disabled for this session. */
  | { kind: 'readOnly' }
  /** 429 quota_exhausted / active_rule_cap. */
  | { kind: 'cap' }
  /** Network, 5xx, other 429 or any other refusal: the dialog stays open. */
  | { kind: 'retry' };

export const MSG = {
  retry: 'Could not reach memory. Try again',
  cap: 'This firm already has 100 active rules. Deactivate one first.',
  changed: 'Already changed',
  readOnly: 'This demo workspace is read-only. Memory cannot be changed here.',
  unavailable: 'Memory unavailable. Findings are shown as New.',
} as const;

export function classifyWriteError(e: unknown): WriteOutcome {
  if (!(e instanceof MemoryApiError)) return { kind: 'retry' };
  if (e.code === 'conflict' || e.code === 'not_found') return { kind: 'changed' };
  if (
    e.code === 'invalid_request' &&
    (e.reason === 'rule_state' || e.reason?.endsWith('_not_found'))
  )
    return { kind: 'changed' };
  if (e.code === 'read_only') return { kind: 'readOnly' };
  if (e.code === 'quota_exhausted' && e.reason === 'active_rule_cap') return { kind: 'cap' };
  return { kind: 'retry' };
}

export async function runWrite(fn: () => Promise<unknown>): Promise<WriteOutcome> {
  try {
    await fn();
    return { kind: 'ok' };
  } catch (e) {
    return classifyWriteError(e);
  }
}
