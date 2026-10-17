import type { CounselSheet } from '@aduin/core';
import { memoryApi } from '../../api/client';
import { MemoryApiError } from '../../api/memoryApi';
import { newClientOpId } from '../../api/realMemoryApi';
import { downloadBlob } from '../../lib/download';
import {
  ensureSession,
  flushOutbox,
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
 * Export order (Phase 08): queued writes drain first, then `ensureRun` (lazy; a no-firm document
 * runs with `law_firm_id: null`), the findings on the sheet are persisted (already stored ids are
 * skipped by the client), Needs-counsel questions are created in ONE batch (firm documents only),
 * the DOCX is built, `POST /api/runs/:id/export` records the export, and only then the file is
 * downloaded. Any failure throws before the download: nothing is shown as exported and the sheet
 * stays editable. Read-only sessions and the no-storage case skip every memory write.
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
  metrics: MetricsRow | null;
}

export class ExportError extends Error {}

function failMessage(e: unknown): string {
  if (e instanceof MemoryApiError) {
    if (e.code === 'rate_limited' || e.code === 'quota_exhausted')
      return 'Memory is busy right now, so the export was not recorded. Try again later.';
    if (e.code === 'unavailable')
      return 'Memory is unavailable, so the export was not recorded. Try again.';
  }
  return 'The query sheet could not be exported. Nothing was marked as exported; try again.';
}

export async function exportCounselSheet(input: ExportInput): Promise<ExportOutcome> {
  const { doc, sheet } = input;
  const now = input.now ?? Date.now;
  const api = memoryApi();
  await ensureSession();
  const writable = api !== null && !writesDisabled();
  let recorded = false;
  let serverAt: number | undefined;
  let blob: Blob;
  try {
    if (writable) {
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
      blob = await buildCounselDocx(sheet, input.wording);
      const res = await api.exportRun(run_id, {
        question_count: sheet.questions.length,
        client_op_id: newClientOpId(),
      });
      recorded = true;
      serverAt = res.sheet_exported_at;
    } else {
      blob = await buildCounselDocx(sheet, input.wording);
    }
  } catch (e) {
    throw new ExportError(failMessage(e));
  }
  const filename = docxFilename(sheet.meta);
  downloadBlob(filename, blob, DOCX_MIME);
  const { states } = gateInputs(input.rows);
  const metrics = await recordExport(
    doc.id,
    {
      findings: input.findings.map((f) => ({ id: f.id, detector_kind: f.detector_kind })),
      states,
      sheetQuestionCount: sheet.questions.length,
      exportedAt: now(),
    },
    serverAt,
  );
  return { filename, questionCount: sheet.questions.length, recorded, metrics };
}
