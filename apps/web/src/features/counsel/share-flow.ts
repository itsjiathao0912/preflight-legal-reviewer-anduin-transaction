import { maskQuote } from '@aduin/core';
import { isRealMemoryApi, memoryApi } from '../../api/client';
import { markReady, shareLink, shareUrl } from '../../api/counselShareApi';
import { MemoryApiError } from '../../api/memoryApi';
import { newClientOpId } from '../../api/realMemoryApi';
import type { FindingView } from '../../engine/types';
import { downloadBlob } from '../../lib/download';
import type { MemoryResult } from '../../memory/fingerprintFindings';
import { ensureSession, flushOutbox, outboxDocFor, writesDisabled } from '../../state/memory-sync';
import type { DocMeta } from '../../state/review';
import { docRefOf } from '../open-document/demo-refs';
import type { Row } from '../review/model';
import type { QuestionItem } from '../variance/owner-groups';
import { useShare } from './counsel-share';
import { NOT_RECORDED_NOTE, syncQuestions } from './export-flow';
import { buildFinalDocx, DOCX_MIME, finalDocxFilename, type FinalQuestion } from './exportDocx';
import { readingsFor } from './QuestionRow';
import type { CounselDrafts } from './sheet-model';
import { wordingFor } from './sheet-model';

/** Why Share is disabled for a document that is not a bundled demo package or sample. */
export const DEMO_ONLY = 'Sharing works for demo packages only.';

/** A refusal shown to the analyst as a toast (plain sentence). */
export class ShareError extends Error {}

export interface ShareInput {
  doc: DocMeta;
  rows: readonly Row[];
  findings: readonly FindingView[];
  memory: MemoryResult | null;
  items: readonly QuestionItem[];
}

/**
 * Share with counsel (analyst): every question of this document is created on the server first
 * (counsel's browser shows "needs counsel" from there), then a fresh link is minted, bound to the
 * bundled document ref. The link is `<origin>/#counsel=<token>` and is valid min(7 days, sandbox
 * expiry). Uploads and assembled packages cannot be shared (counsel re-opens bundled files only).
 */
export async function shareWithCounsel(
  input: ShareInput,
): Promise<{ url: string; expiresAt: number }> {
  const { doc } = input;
  const docRef = docRefOf(doc);
  if (!docRef) throw new ShareError(DEMO_ONLY);
  if (!doc.firmId) {
    throw new ShareError('Tag a law firm first: counsel answers are kept per law firm.');
  }
  const api = memoryApi();
  if (!isRealMemoryApi(api)) {
    throw new ShareError('Sharing needs the memory service, which is not available here.');
  }
  await ensureSession();
  if (writesDisabled()) {
    throw new ShareError('This demo workspace is read-only. Open a sample to get your own copy.');
  }
  if (!input.items.length) {
    throw new ShareError('There are no questions to share yet.');
  }
  try {
    await flushOutbox();
    const key = await outboxDocFor(doc);
    const { run_id } = await api.ensureRun({ ...key, client_op_id: newClientOpId() });
    await syncQuestions(
      api,
      run_id,
      input,
      input.items.map((q) => ({ findingKey: q.key, interpretations: readingsFor(q.row) })),
    );
    const res = await shareLink(docRef);
    const link = { url: shareUrl(res.token), expiresAt: res.expires_at };
    useShare.getState().setLink(link);
    return link;
  } catch (e) {
    if (e instanceof MemoryApiError && e.code === 'read_only') {
      throw new ShareError('This demo workspace is read-only. Open a sample to get your own copy.');
    }
    throw new ShareError('The share link could not be created. Try again in a moment.');
  }
}

/**
 * Analyst, after "Ask counsel" while a share link exists: create the new question(s) on the server
 * now, so counsel sees them on the next poll (and both sides can comment). Silent on failure (the
 * next Share or Export syncs them). Returns how many were created.
 */
export async function pushSharedQuestions(input: ShareInput): Promise<number> {
  const { doc } = input;
  if (!useShare.getState().link || !doc.firmId || !docRefOf(doc)) return 0;
  const api = memoryApi();
  if (!isRealMemoryApi(api) || writesDisabled() || !input.items.length) return 0;
  try {
    await flushOutbox();
    const key = await outboxDocFor(doc);
    const { run_id } = await api.ensureRun({ ...key, client_op_id: newClientOpId() });
    return await syncQuestions(
      api,
      run_id,
      input,
      input.items.map((q) => ({ findingKey: q.key, interpretations: readingsFor(q.row) })),
    );
  } catch {
    return 0;
  }
}

/** Answer fields recorded for one question (per owner for change questions). */
export function recordedFor(q: QuestionItem): Pick<FinalQuestion, 'option' | 'note' | 'by' | 'at'> {
  const t = q.row.triage;
  if (q.change) {
    const info = t?.ownerAnswerInfo?.[q.owner];
    return { option: q.answer ?? null, note: info?.note, by: info?.by, at: info?.at };
  }
  return {
    option: t?.counselAnswer ?? null,
    note: t?.counselNote,
    by: t?.answeredBy,
    at: t?.answeredAt,
  };
}

export function finalQuestions(
  items: readonly QuestionItem[],
  drafts: CounselDrafts,
): FinalQuestion[] {
  return items.map((q, i) => ({
    number: i + 1,
    text: wordingFor(q.row, drafts, q.key).text,
    location: q.row.f.loc,
    quote: maskQuote(q.row.f.quote),
    interpretations: readingsFor(q.row),
    ...recordedFor(q),
  }));
}

/**
 * Mark ready to digitize (analyst, gate green): the final DOCX is built and downloaded FIRST (the
 * deliverable never waits on the server), then `POST /api/counsel/ready` records one audit event.
 * Returns the server time, or null with a note when it could not be recorded.
 */
export async function markReadyToDigitize(input: {
  doc: DocMeta;
  items: readonly QuestionItem[];
  drafts: CounselDrafts;
}): Promise<{ filename: string; readyAt: number | null; note: string | null }> {
  const { doc } = input;
  const meta = {
    title: `Counsel answers · ${doc.fund || doc.name || 'Document'}`,
    firm: doc.firmId ? doc.firmName || null : null,
    fund: doc.fund || null,
    version: doc.version || null,
  };
  const blob = await buildFinalDocx(meta, finalQuestions(input.items, input.drafts));
  const filename = finalDocxFilename(meta);
  downloadBlob(filename, blob, DOCX_MIME);
  const local = () => {
    // the pill still reflects the analyst's action in this browser
    useShare.getState().setReadyAt(Date.now());
    return { filename, readyAt: null, note: NOT_RECORDED_NOTE };
  };
  const api = memoryApi();
  if (!isRealMemoryApi(api) || !doc.firmId) return local();
  try {
    await ensureSession();
    if (writesDisabled()) return local();
    const at = await markReady();
    useShare.getState().setReadyAt(at);
    return { filename, readyAt: at, note: null };
  } catch {
    return local();
  }
}
