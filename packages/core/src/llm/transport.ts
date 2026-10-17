import { z } from 'zod';
import { AI_TASK_IDS } from '../contracts/ai';
import type { LlmMessage, LlmUsage } from './task';

/**
 * Transport seam. CI uses a RecordedTransport (test helper, throws on a miss, no network); the live
 * path goes through the Worker (`POST /api/ai`), which owns prompts, keys and quotas.
 */
export interface TransportRequest {
  taskId: (typeof AI_TASK_IDS)[number];
  promptVersion: string;
  model: string;
  messages: readonly LlmMessage[];
  /** `inputHash(messages)` */
  inputHash: string;
}

export interface TransportResponse {
  /** Raw model message content (may hold prose around the JSON). */
  raw: string;
  /** Parsed model JSON (before envelope wrap), or null if it did not parse. */
  parsed: unknown;
  servedModel: string;
  usage?: LlmUsage;
}

export interface LlmTransport {
  send(req: TransportRequest): Promise<TransportResponse>;
}

/** Thrown by a recorded transport when no recording matches the inputHash. */
export class RecordingMissError extends Error {
  constructor(readonly inputHash: string) {
    super(`no recording for inputHash ${inputHash.slice(0, 16)}`);
    this.name = 'RecordingMissError';
  }
}

/** On-disk recording: `fixtures/llm-recordings/{taskId}/{inputHash16}.json`. */
export const LlmRecordingSchema = z.object({
  taskId: z.enum(AI_TASK_IDS),
  promptVersion: z.string().min(1).max(40),
  inputHash: z.string().regex(/^[0-9a-f]{64}$/),
  model: z.string().min(1).max(120),
  /** = inputHash of the forwarded messages (kept for audit of the request body). */
  messagesDigest: z.string().regex(/^[0-9a-f]{64}$/),
  response: z.object({ raw: z.string(), parsed: z.unknown() }),
  meta: z.object({
    source: z.enum(['authored', 'live']),
    served_model: z.string().min(1).max(120),
    tokens: z
      .object({ in: z.number().int().nonnegative(), out: z.number().int().nonnegative() })
      .optional(),
    recordedAt: z.string().min(1).max(40),
  }),
});
export type LlmRecording = z.infer<typeof LlmRecordingSchema>;

/** Relative recording path for a task + inputHash. */
export function recordingPath(taskId: string, inputHash: string): string {
  return `${taskId}/${inputHash.slice(0, 16)}.json`;
}
