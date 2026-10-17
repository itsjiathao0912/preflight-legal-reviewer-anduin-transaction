import { limits, maskAndClamp, type AiCandidate, type IssueClass } from '@aduin/core';
import { apiEnabled } from '../../api/base';
import { requestAi } from '../ai/stream-client';
import { cleanWording } from './counsel-store';

/**
 * AI counsel-question draft (Phase 05 `counsel-draft` task through the same `/api/ai` transport;
 * counts against the visitor's daily AI allowance). The quote sent is masked first. Every returned
 * `drafts[].text` is masked and clamped (L6) before it reaches the drafts UI; unknown candidate ids
 * are ignored. Any failure returns `ok: false` and the template draft stays (fallback).
 */
export interface DraftSource {
  id: string;
  quote: string;
  section_path: string[];
  issue_class: string;
}

export type AiDraftResult =
  | { ok: true; drafts: Record<string, string>; model: string }
  | { ok: false; reason: 'off' | 'unavailable' | 'empty' };

/** Pure: read `drafts[]` from an AI result payload, keep known ids, mask + clamp (L6). */
export function readAiDrafts(data: unknown, ids: ReadonlySet<string>): Record<string, string> {
  const out: Record<string, string> = {};
  const list = data && typeof data === 'object' ? (data as { drafts?: unknown }).drafts : undefined;
  if (!Array.isArray(list)) return out;
  for (const d of list) {
    if (!d || typeof d !== 'object') continue;
    const id = (d as { candidate_id?: unknown }).candidate_id;
    const text = (d as { text?: unknown }).text;
    if (typeof id !== 'string' || !ids.has(id) || typeof text !== 'string') continue;
    const clean = cleanWording(text);
    if (clean) out[id] = clean;
  }
  return out;
}

export function draftCandidates(items: readonly DraftSource[]): AiCandidate[] {
  return items.slice(0, limits.aiCandidates).map((i) => ({
    id: i.id,
    quote: maskAndClamp(i.quote, limits.quoteMaxChars),
    section_path: i.section_path.slice(0, 8).map((s) => s.slice(0, 300)),
    issue_class_hint: i.issue_class as IssueClass,
  }));
}

export async function fetchAiDrafts(
  items: readonly DraftSource[],
  docHash: string,
  aiOn: boolean,
  signal?: AbortSignal,
): Promise<AiDraftResult> {
  if (!aiOn || !apiEnabled()) return { ok: false, reason: 'off' };
  const candidates = draftCandidates(items);
  if (!candidates.length) return { ok: false, reason: 'empty' };
  let t;
  try {
    t = await requestAi({
      task: 'counsel-draft',
      docHash,
      // drafts do not need firm rules; no firm is sent (rules hash 'none')
      lawFirmId: null,
      candidates,
      ...(signal ? { signal } : {}),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (t.kind !== 'result' || t.resultKind !== 'ai') return { ok: false, reason: 'unavailable' };
  const drafts = readAiDrafts(t.data, new Set(candidates.map((c) => c.id)));
  if (!Object.keys(drafts).length) return { ok: false, reason: 'unavailable' };
  return { ok: true, drafts, model: t.model };
}
