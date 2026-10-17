import { sha256Hex } from '../model/hash';
import type { LlmMessage, LlmTask } from './task';

/**
 * AI output token cap: the single source for the Worker body (`MAX_TOKENS.ai`) and the recording
 * scripts (review L1). Live sample #3 used 5783 output tokens. Not part of `inputHash`, so a change
 * never invalidates recordings or cache keys.
 */
export const AI_MAX_TOKENS = 10_000;

/** Response mode chosen by the live probe (R1 strict json_schema, R2 json_object fallback). */
export type AiResponseMode = 'json_schema' | 'json_object';

/** OpenRouter/OpenAI `response_format` for a task. */
export function responseFormat(task: LlmTask, mode: AiResponseMode = 'json_schema'): unknown {
  if (mode === 'json_object') return { type: 'json_object' };
  return {
    type: 'json_schema',
    json_schema: {
      name: task.modelResultSchema.name,
      strict: true,
      schema: task.modelResultSchema.schema,
    },
  };
}

/** For `json_object` mode: the schema is stated in the prompt instead (appended system message). */
export function schemaInstruction(task: LlmTask): LlmMessage {
  return {
    role: 'system',
    content:
      'Reply with one JSON object only, no prose, matching this JSON schema exactly: ' +
      JSON.stringify(task.modelResultSchema.schema),
  };
}

/**
 * inputHash: sha256 hex of the exact forwarded messages JSON. The single choke point for the
 * recordings, the cache key `input_hash` and the record-body parity test.
 */
export function inputHash(messages: readonly LlmMessage[]): string {
  return sha256Hex(JSON.stringify(messages.map((m) => ({ role: m.role, content: m.content }))));
}

/** Recording file stem: first 16 hex chars of the inputHash. */
export function inputHash16(hash: string): string {
  return hash.slice(0, 16);
}
