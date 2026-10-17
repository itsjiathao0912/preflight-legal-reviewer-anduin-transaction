import { AiResultSchema, type AiCandidate } from '../../contracts/ai';
import { maskText } from '../../detectors/util';
import type { DiffResult, Excerpt, Rename } from '../../diff/types';
import { mask } from '../../memory/mask';
import type { ModelResultSchema } from '../schemas';
import type { LlmTask, LlmTaskInput, TaskValidation } from '../task';
import { UNTRUSTED_NOTICE, userMessage, wrapEnvelope } from './shared';

/**
 * Phase 07 (07c): AI narrative of the rename drift between two versions (AC15 H part).
 *
 * Inputs are built ONLY from `DiffResult.renames` plus one sample aligned sentence pair per rename,
 * MASKED (sensitiveSpans, then the account-number pattern again) and CLIPPED after masking (E18).
 * The validator keeps only drafts that answer a sent rename AND name both its old and new term, so
 * the narrative can never state a rename the deterministic diff did not find.
 */
export const DRIFT_NARRATIVE_PROMPT_VERSION = 'drift-narrative@1';
export const DRIFT_NARRATIVE_SCHEMA_VERSION = 'drift-narrative.s1';

/** Renames sent per request (largest count first, then document order of `renames`). */
export const NARRATIVE_MAX_RENAMES = 8;
/** Characters of masked context kept around the renamed term on each side. */
export const NARRATIVE_SAMPLE_CHARS = 240;
/** Longest narrative line shown (model schema bound). */
export const NARRATIVE_TEXT_MAX = 600;

const DraftItem = AiResultSchema.shape.drafts.unwrap().element;

export const DRIFT_NARRATIVE_MODEL_SCHEMA: ModelResultSchema = Object.freeze({
  name: 'drift_narrative_v1',
  schema: Object.freeze({
    type: 'object',
    additionalProperties: false,
    required: ['drafts'],
    properties: {
      drafts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidate_id', 'text'],
          properties: {
            candidate_id: { type: 'string', minLength: 1, maxLength: 64 },
            text: { type: 'string', minLength: 1, maxLength: NARRATIVE_TEXT_MAX },
          },
        },
      },
    },
  }),
});

const SYSTEM = [
  'You summarize terminology changes between two versions of a fund subscription document for a digitization analyst.',
  'Each excerpt is one rename that the comparison engine already detected (candidate_id = the excerpt id), ' +
    'with a sample sentence before and after the change.',
  'For each excerpt write one or two plain sentences (at most 400 characters) that explain the rename and what ' +
    'the analyst should re-check (for example form labels, defined terms or option text). ' +
    'Name both the old term and the new term exactly as given.',
  'Only describe the renames you were given; do not mention any other change, term, section number, fee or fact.',
  UNTRUSTED_NOTICE,
  'Answer with JSON only.',
].join('\n');

const RENAME_LINE = /^Rename: "([^"\n]{1,80})" -> "([^"\n]{1,80})"/;

/** The rename a candidate describes (first quote line), or undefined for a foreign candidate. */
export function renameOfCandidate(c: AiCandidate): { from: string; to: string } | undefined {
  const m = RENAME_LINE.exec(c.quote);
  return m ? { from: m[1]!, to: m[2]! } : undefined;
}

/** A narrative line is kept only when it names both terms of its rename (case-insensitive). */
export function mentionsRename(text: string, r: { from: string; to: string }): boolean {
  const t = text.toLowerCase();
  return t.includes(r.from.toLowerCase()) && t.includes(r.to.toLowerCase());
}

/** Mask the excerpt with its spans, mask again by pattern, then clip around `term` (never before). */
function maskedWindow(ex: Excerpt, term: string): string | undefined {
  const masked = maskText(mask(ex.text, ex.sensitiveSpans)).replace(/\s+/g, ' ');
  const at = masked.indexOf(term);
  if (at < 0) return undefined;
  const half = Math.floor((NARRATIVE_SAMPLE_CHARS - term.length) / 2);
  const s = Math.max(0, at - Math.max(0, half));
  const e = Math.min(masked.length, s + NARRATIVE_SAMPLE_CHARS);
  return (
    (s > 0 || ex.clippedStart ? '…' : '') +
    masked.slice(s, e).trim() +
    (e < masked.length || ex.clippedEnd ? '…' : '')
  );
}

function sampleFor(
  r: DiffResult,
  x: Rename,
): { before: string; after: string; path: string[] } | undefined {
  for (const s of r.sections) {
    if (!s.a || !s.b) continue;
    if (s.status !== 'changed' && s.status !== 'renamed' && s.status !== 'moved') continue;
    const before = maskedWindow(s.a, x.from);
    const after = before ? maskedWindow(s.b, x.to) : undefined;
    if (before && after) return { before, after, path: [...(s.pathB ?? s.pathA ?? [])] };
  }
  // fallback: the renamed defined term's own definition excerpts
  for (const d of r.definitions) {
    if (d.status !== 'renamed' || !d.a || !d.b) continue;
    const before = maskedWindow(d.a, x.from);
    const after = before ? maskedWindow(d.b, x.to) : undefined;
    if (before && after) return { before, after, path: [...(d.pathB ?? d.pathA ?? [])] };
  }
  return undefined;
}

/**
 * Narrative candidates from a version diff: one per rename (at most NARRATIVE_MAX_RENAMES), with a
 * masked and clipped sample sentence pair. Pure; safe on the main thread (no parser imports).
 * Empty when the result has no renames (the UI then offers nothing to summarize).
 */
export function buildDriftNarrativeCandidates(r: DiffResult): AiCandidate[] {
  if (r.mode !== 'version') return [];
  const ranked = r.renames
    .map((x, i) => ({ x, i }))
    .sort((p, q) => q.x.count - p.x.count || p.i - q.i)
    .slice(0, NARRATIVE_MAX_RENAMES);
  return ranked.map(({ x }, n) => {
    const sample = sampleFor(r, x);
    const lines = [`Rename: "${x.from}" -> "${x.to}" (${x.count} of ${x.occurrences} occurrences)`];
    if (sample) lines.push(`Before: ${sample.before}`, `After: ${sample.after}`);
    // final pattern mask over the whole quote (E18 belt and braces), then the contract bound
    const quote = maskText(lines.join('\n')).slice(0, 1000);
    return {
      id: `rn_${String(n + 1).padStart(2, '0')}`,
      quote,
      section_path: (sample?.path ?? []).slice(0, 8).map((p) => maskText(p).slice(0, 300)),
    };
  });
}

/** Keep only drafts whose candidate is a sent rename and whose text names both its terms. */
function keepNamedRenames(v: TaskValidation, input: LlmTaskInput): TaskValidation {
  if (!v.ok) return v;
  const byId = new Map(input.candidates.map((c) => [c.id, renameOfCandidate(c)]));
  const drafts = v.result.drafts ?? [];
  const kept = drafts.filter((d) => {
    const rn = byId.get(d.candidate_id);
    return !!rn && d.text.length <= NARRATIVE_TEXT_MAX && mentionsRename(d.text, rn);
  });
  const extra = drafts.length - kept.length;
  if (extra === 0) return v;
  const dropped = v.dropped + extra;
  const parsed = AiResultSchema.safeParse({
    ...v.result,
    drafts: kept,
    ext: { ...(v.result.ext ?? {}), dropped },
  });
  return parsed.success
    ? { ok: true, result: parsed.data, dropped }
    : { ok: false, reason: 'malformed' };
}

export interface NarrativeLine {
  from: string;
  to: string;
  /** Masked model text (React renders it as text only). */
  text: string;
}

/**
 * Main-thread reader for an `/api/ai` drift-narrative result: envelope check, the same rename rule
 * as the validator, masked text. `null` when the data is not a usable AiResult.
 */
export function readDriftNarrative(
  data: unknown,
  candidates: readonly AiCandidate[],
): NarrativeLine[] | null {
  const p = AiResultSchema.safeParse(data);
  if (!p.success) return null;
  const byId = new Map(candidates.map((c) => [c.id, renameOfCandidate(c)]));
  const out: NarrativeLine[] = [];
  const seen = new Set<string>();
  for (const d of p.data.drafts ?? []) {
    const rn = byId.get(d.candidate_id);
    if (!rn || seen.has(d.candidate_id) || d.text.length > NARRATIVE_TEXT_MAX) continue;
    if (!mentionsRename(d.text, rn)) continue;
    seen.add(d.candidate_id);
    out.push({ ...rn, text: maskText(d.text) });
  }
  return out;
}

const driftNarrativeV1Def: LlmTask = {
  id: 'drift-narrative',
  promptVersion: DRIFT_NARRATIVE_PROMPT_VERSION,
  schemaVersion: DRIFT_NARRATIVE_SCHEMA_VERSION,
  requestKind: 'ai',
  modelResultSchema: DRIFT_NARRATIVE_MODEL_SCHEMA,
  buildMessages: (input, rules) => [{ role: 'system', content: SYSTEM }, userMessage(input, rules)],
  validate: (modelJson, input, usage) =>
    keepNamedRenames(wrapEnvelope(modelJson, input, usage, 'drafts', DraftItem), input),
};
export const driftNarrativeV1: LlmTask = Object.freeze(driftNarrativeV1Def);
