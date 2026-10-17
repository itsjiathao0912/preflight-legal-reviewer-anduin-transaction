import type { AiCandidate, AiResult, AiTaskId } from '../contracts/ai';
import type { InjectedRules } from './rules';
import type { ModelResultSchema } from './schemas';

/** One chat message forwarded to the model (the client never sends prompts; the Worker builds them). */
export interface LlmMessage {
  role: 'system' | 'user';
  content: string;
}

/** Task input: graph-selected candidates (already masked by `buildAiCandidates`). */
export interface LlmTaskInput {
  candidates: readonly AiCandidate[];
}

/** Usage block the Worker copies from the provider response into the envelope. */
export interface LlmUsage {
  tokens_in?: number;
  tokens_out?: number;
}

export type TaskValidation =
  { ok: true; result: AiResult; dropped: number } | { ok: false; reason: 'malformed' };

/**
 * A versioned LLM task. `promptVersion` is the cache key `prompt_ver`, `schemaVersion` the
 * `schema_ver`; bumping either invalidates caches and precomputed files by design.
 */
export interface LlmTask {
  id: AiTaskId;
  promptVersion: string;
  schemaVersion: string;
  requestKind: 'ai';
  buildMessages(input: LlmTaskInput, rules: InjectedRules): LlmMessage[];
  modelResultSchema: ModelResultSchema;
  /**
   * Wrap the parsed model JSON into the AiResult envelope (v:1, usage; drop count in
   * `ext.dropped`), keep only individually valid items whose `candidate_id` was sent, and
   * validate the envelope once with `AiResultSchema`.
   */
  validate(modelJson: unknown, input: LlmTaskInput, usage?: LlmUsage): TaskValidation;
}
