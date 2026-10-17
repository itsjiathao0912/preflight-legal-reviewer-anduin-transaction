import type { CounselSheet } from '@aduin/core';
import { memoryApi } from '../../api/client';
import type { MemoryApi } from '../../api/memoryApi';
import { newClientOpId } from '../../api/realMemoryApi';
import { downloadBlob } from '../../lib/download';
import {
  ensureSession,
  flushOutbox,
  memoryDown,
  outboxDocFor,
  toFindingWire,
  writesDisabled,
} from '../../state/memory-sync';
import type { DocMeta } from '../../state/review';
import type { FindingView } from '../../engine/types';
import type { MemoryResult } from '../../memory/fingerprintFindings';
import { recordExport, type MetricsRow } from '../metrics/metrics-store';
import type { Row } from '../review/model';
import { buildCounselDocx, docxFilename, DOCX_MIME } from './exportDocx';
import { readQuestionIds, saveQuestionIds } from './question-ids';
import { gateInputs } from './sheet-model';

/**
 * Export order (Phase 08, review fix F1): the DOCX is built FIRST, so a broken or absent memory
 * backend never blocks the analyst's deliverable. Then, best-effort: queued writes drain,
 * `ensureRun` (lazy; a no-firm document runs with `law_firm_id: null`), the findings on the sheet
 * are persisted (already stored ids are skipped), Needs-counsel questions are created in ONE batch
 * (firm documents only) and `POST /api/runs/:id/export` records the export. Any memory failure is
 * swallowed: `recorded` stays false, the file is still downloaded and the toast carries the quiet
 * note "Saved locally; not recorded in memory". Only a DOCX build failure throws `ExportError`
 * (nothing downloaded, the sheet stays editable). Read-only sessions and the no-storage case skip
 * every memory write.
 */
export interface ExportInput {
  doc: DocMeta;
  sheet: CounselSheet;
  rows: readonly Row[];
  findings: readonly FindingView[];
  memory: MemoryResult | null;
  wording: (findingKey: string) => string;
  now?: () => number;
}

export interface ExportOutcome {
  filename: string;
  questionCount: number;
  /** True when the export was recorded in memory (run + audit row). */
  recorded: boolean;
  /** Set when memory was writable but recording failed: the file was still downloaded. */
  memoryNote: string | null;
  metrics: MetricsRow | null;
}

export const NOT_RECORDED_NOTE = 'Saved locally; not recorded in memory.';

export class ExportError extends Error {}

export async function exportCounselSheet(input: ExportInput): Promise<ExportOutcome> {
  const { doc, sheet } = input;
  const now = input.now ?? Date.now;
  let blob: Blob;
  try {
    blob = await buildCounselDocx(sheet, input.wording);
  } catch {
    throw new ExportError(
      'The query sheet could not be exported. Nothing was marked as exported; try again.',
    );
  }
  let api: ReturnType<typeof memoryApi> = null;
  let writable: boolean;
  try {
    api = memoryApi();
    await ensureSession();
    writable = api !== null && !writesDisabled();
  } catch {
    writable = false;
  }
  let recorded = false;
  let memoryNote: string | null = null;
  let serverAt: number | undefined;
  if (writable && api && memoryDown()) {
    memoryNote = NOT_RECORDED_NOTE;
  } else if (writable && api) {
    try {
      serverAt = await recordInMemory(api, input);
      recorded = true;
    } catch {
      memoryNote = NOT_RECORDED_NOTE;
    }
  }
  const filename = docxFilename(sheet.meta);
  downloadBlob(filename, blob, DOCX_MIME);
  const { states } = gateInputs(input.rows);
  let metrics: MetricsRow | null;
  try {
    metrics = await recordExport(
      doc.id,
      {
        findings: input.findings.map((f) => ({ id: f.id, detector_kind: f.detector_kind })),
        states,
        sheetQuestionCount: sheet.questions.length,
        exportedAt: now(),
      },
      serverAt,
    );
  } catch {
    metrics = null;
  }
  return { filename, questionCount: sheet.questions.length, recorded, memoryNote, metrics };
}

/** Best-effort memory recording; returns the server export time. Throws on any memory failure. */
async function recordInMemory(api: MemoryApi, input: ExportInput): Promise<number> {
  const { doc, sheet } = input;
  await flushOutbox();
  const key = await outboxDocFor(doc);
  const { run_id } = await api.ensureRun({ ...key, client_op_id: newClientOpId() });
  if (doc.firmId && sheet.questions.length) {
    const have = await readQuestionIds(doc.id);
    const byId = new Map(input.findings.map((f) => [f.id, f]));
    const need = sheet.questions.flatMap((q) => {
      const f = byId.get(q.findingKey);
      const fp = input.memory?.byId[q.findingKey]?.fingerprint ?? null;
      return !have[q.findingKey] && f && fp ? [{ q, f, fp }] : [];
    });
    if (need.length) {
      await api.storeFindings(
        run_id,
        need.map((n) => toFindingWire(n.f, n.fp)),
      );
      const created = await api.createQuestions(
        run_id,
        need.map((n) => ({
          client_op_id: newClientOpId(),
          finding_ref: n.q.findingKey,
          fingerprint: n.fp,
          interpretations: n.q.interpretations,
        })),
      );
      await saveQuestionIds(
        doc.id,
        Object.fromEntries(created.map((c) => [c.finding_ref, c.question_id])),
      );
    }
  }
  const res = await api.exportRun(run_id, {
    question_count: sheet.questions.length,
    client_op_id: newClientOpId(),
  });
  return res.sheet_exported_at;
}
