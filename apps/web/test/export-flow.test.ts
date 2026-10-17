// @vitest-environment node
import 'fake-indexeddb/auto';
import { buildCounselSheet, type GateState } from '@aduin/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryApiError, type MemoryApi } from '../src/api/memoryApi';
import type { FindingView } from '../src/engine/types';
import type { DocMeta } from '../src/state/review';

// Review fix F1: the DOCX is built first; memory recording is best-effort. A 503 memory backend
// (the live demo has no D1) must still download the file with a quiet "not recorded" note.
const h = vi.hoisted(() => ({
  api: null as MemoryApi | null,
  down: false,
  readOnly: false,
  failDocx: false,
  downloads: [] as string[],
}));
vi.mock('../src/api/client', () => ({ memoryApi: () => h.api, isRealMemoryApi: () => false }));
vi.mock('../src/lib/download', () => ({
  downloadBlob: (name: string) => {
    h.downloads.push(name);
  },
}));
vi.mock('../src/state/memory-sync', () => ({
  ensureSession: async () => undefined,
  flushOutbox: async () => undefined,
  memoryDown: () => h.down,
  writesDisabled: () => h.readOnly,
  outboxDocFor: async (d: { id: string }) => ({
    doc_name: 'x',
    doc_hash: d.id,
    law_firm_id: 'partners-group',
    settings_hash: 'd'.repeat(64),
  }),
  toFindingWire: (f: FindingView, fingerprint: string) => ({ id: f.id, fingerprint }),
}));
vi.mock('../src/features/metrics/metrics-store', () => ({ recordExport: async () => null }));
vi.mock('../src/features/counsel/exportDocx', async (orig) => {
  const real = await orig<typeof import('../src/features/counsel/exportDocx')>();
  return {
    ...real,
    buildCounselDocx: (...a: Parameters<typeof real.buildCounselDocx>) =>
      h.failDocx ? Promise.reject(new Error('docx broke')) : real.buildCounselDocx(...a),
  };
});

const { exportCounselSheet, ExportError, NOT_RECORDED_NOTE } =
  await import('../src/features/counsel/export-flow');

const DOC = {
  id: 'c'.repeat(64),
  name: 'PG NGI 2026',
  firmId: 'partners-group',
  firmName: 'Partners Group',
  fund: 'NGI',
  version: '2026',
  source: 'sample',
  ref: '05',
} as unknown as DocMeta;
const FINDING = {
  id: 'f1',
  severity: 'critical',
  detector_kind: 'rule',
  issue_class: 'broken_cross_reference',
  location: 'Section 1',
  quote: 'See Part B of Section 6.',
} as const;
const states: Record<string, GateState> = { f1: { status: 'counsel' } };
const sheet = buildCounselSheet(
  { title: 'Counsel query sheet · NGI', firm: 'Partners Group', fund: 'NGI', version: '2026' },
  [FINDING],
  states,
  {},
);

function api(fail: Partial<Record<keyof MemoryApi, boolean>> = {}) {
  const calls: string[] = [];
  const err = () => new MemoryApiError('unavailable', 'HTTP 503', { reason: 'memory_unavailable' });
  const m = (name: keyof MemoryApi, ok: () => unknown) => async () => {
    calls.push(name);
    if (fail[name]) throw err();
    return ok();
  };
  const a = {
    ensureRun: m('ensureRun', () => ({ run_id: 'r_1' })),
    storeFindings: m('storeFindings', () => ({ stored: 1 })),
    createQuestions: m('createQuestions', () => [{ finding_ref: 'f1', question_id: 'q_1' }]),
    exportRun: m('exportRun', () => ({ sheet_exported_at: 123 })),
  };
  return { api: a as unknown as MemoryApi, calls };
}

function run() {
  return exportCounselSheet({
    doc: DOC,
    sheet,
    rows: [],
    findings: [FINDING as unknown as FindingView],
    memory: {
      byId: { f1: { fingerprint: 'a'.repeat(64), label: 'new', prior: null } },
      applied: true,
      unavailable: false,
    } as never,
    wording: () => 'Which section holds the custodian fields?',
  });
}

beforeEach(() => {
  h.api = null;
  h.down = false;
  h.readOnly = false;
  h.failDocx = false;
  h.downloads = [];
});

describe('export-flow (F1)', () => {
  it('should still download the DOCX when memory answers 503 on ensureRun', async () => {
    const f = api({ ensureRun: true });
    h.api = f.api;
    const out = await run();
    expect(h.downloads).toEqual(['counsel-questions-ngi.docx']);
    expect(out.recorded).toBe(false);
    expect(out.memoryNote).toBe(NOT_RECORDED_NOTE);
    expect(NOT_RECORDED_NOTE).toBe('Saved locally; not recorded in memory.');
  });

  it('should still download when createQuestions or exportRun fail with 503', async () => {
    for (const k of ['storeFindings', 'createQuestions', 'exportRun'] as const) {
      h.downloads = [];
      const f = api({ [k]: true });
      h.api = f.api;
      const out = await run();
      expect(h.downloads).toHaveLength(1);
      expect(out.recorded).toBe(false);
      expect(out.memoryNote).toBe(NOT_RECORDED_NOTE);
    }
  });

  it('should skip every memory call and note it when the session bootstrap was unavailable', async () => {
    const f = api();
    h.api = f.api;
    h.down = true;
    const out = await run();
    expect(f.calls).toEqual([]);
    expect(h.downloads).toHaveLength(1);
    expect(out.memoryNote).toBe(NOT_RECORDED_NOTE);
  });

  it('should record the export when memory works', async () => {
    const f = api();
    h.api = f.api;
    const out = await run();
    expect(f.calls).toContain('exportRun');
    expect(out.recorded).toBe(true);
    expect(out.memoryNote).toBeNull();
    expect(h.downloads).toHaveLength(1);
  });

  it('read-only or no memory client: downloads, not recorded, no failure note', async () => {
    h.readOnly = true;
    const f = api();
    h.api = f.api;
    const out = await run();
    expect(f.calls).toEqual([]);
    expect(out.recorded).toBe(false);
    expect(out.memoryNote).toBeNull();
    expect(h.downloads).toHaveLength(1);
  });

  it('should throw ExportError and download nothing only when the DOCX build fails', async () => {
    const f = api();
    h.api = f.api;
    h.failDocx = true;
    await expect(run()).rejects.toBeInstanceOf(ExportError);
    expect(h.downloads).toEqual([]);
    expect(f.calls).toEqual([]);
  });
});
