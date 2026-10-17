import type { AuditEvent, FirmMemoryResponse, Rule } from '@aduin/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { memoryApi } from '../../api/client';
import type { MemoryApi } from '../../api/memoryApi';
import { ensureSession } from '../../state/memory-sync';
import { useReview } from '../../state/review';
import { useSession } from '../../state/session';

export type MemoryStatus = 'noFirm' | 'loading' | 'ok' | 'unavailable';

export interface MemoryData {
  /** Firm of the open document (null: empty state, no memory call). */
  firmId: string | null;
  firmName: string;
  status: MemoryStatus;
  /** Read-only demo session (POST /api/session `read_only`): every write is disabled. */
  readOnly: boolean;
  firm: FirmMemoryResponse | null;
  /** GET /api/rules: proposed | active | rejected. */
  rules: Rule[];
  /** Loaded audit pages (newest first). */
  audit: AuditEvent[];
  nextCursor: string | null;
  auditLoading: boolean;
  loadMoreAudit: () => Promise<void>;
  /** Re-read firm, rules and the newest audit page (after a write). */
  refetch: () => Promise<void>;
  api: () => MemoryApi | null;
}

interface Loaded {
  firm: FirmMemoryResponse | null;
  rules: Rule[];
  audit: AuditEvent[];
  nextCursor: string | null;
}

const EMPTY: Loaded = { firm: null, rules: [], audit: [], nextCursor: null };

/**
 * Firm memory data for the open document's firm (G7). Loads `firm()`, `listRules()` and the first
 * `audit()` page through the Phase 08 client; `audit(cursor)` for Load more. Any load failure
 * (503, network, 400 `unknown_firm`) is "Memory unavailable" (no fabricated rows). Reloads when
 * the firm changes; with no firm it makes no call.
 */
export function useMemoryData(): MemoryData {
  const firmId = useReview((s) => s.doc?.firmId ?? null);
  const firmName = useReview((s) => s.doc?.firmName ?? '');
  const readOnly = useSession((s) => s.readOnly);
  const [status, setStatus] = useState<MemoryStatus>(firmId ? 'loading' : 'noFirm');
  const [data, setData] = useState<Loaded>(EMPTY);
  const [auditLoading, setAuditLoading] = useState(false);
  const seq = useRef(0);

  const load = useCallback(
    async (quiet: boolean) => {
      const my = ++seq.current;
      if (!firmId) {
        setStatus('noFirm');
        setData(EMPTY);
        return;
      }
      if (!quiet) setStatus('loading');
      const api = memoryApi();
      if (!api) {
        setStatus('unavailable');
        return;
      }
      try {
        await ensureSession();
        const [firm, rules, page] = await Promise.all([
          api.firm(firmId),
          api.listRules(firmId),
          api.audit(),
        ]);
        if (my !== seq.current) return;
        setData({ firm, rules, audit: page.events, nextCursor: page.next_cursor ?? null });
        setStatus('ok');
      } catch {
        if (my !== seq.current) return;
        setData(EMPTY);
        setStatus('unavailable');
      }
    },
    [firmId],
  );

  useEffect(() => {
    void load(false);
    return () => {
      seq.current++;
    };
  }, [load]);

  const loadMoreAudit = useCallback(async () => {
    const cursor = data.nextCursor;
    const api = memoryApi();
    if (!cursor || !api || auditLoading) return;
    const my = seq.current;
    setAuditLoading(true);
    try {
      const page = await api.audit(cursor);
      if (my !== seq.current) return;
      setData((d) => {
        const have = new Set(d.audit.map((e) => e.id));
        return {
          ...d,
          audit: [...d.audit, ...page.events.filter((e) => !have.has(e.id))],
          nextCursor: page.next_cursor ?? null,
        };
      });
    } catch {
      /* keep the loaded pages; the button stays for another try */
    } finally {
      setAuditLoading(false);
    }
  }, [data.nextCursor, auditLoading]);

  const refetch = useCallback(() => load(true), [load]);

  return {
    firmId,
    firmName,
    status,
    readOnly,
    firm: data.firm,
    rules: data.rules,
    audit: data.audit,
    nextCursor: data.nextCursor,
    auditLoading,
    loadMoreAudit,
    refetch,
    api: memoryApi,
  };
}
