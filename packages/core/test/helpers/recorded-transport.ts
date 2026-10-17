import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AiCandidate } from '../../src/contracts/ai';
import { TASKS } from '../../src/llm/registry';
import { selectInjectedRules } from '../../src/llm/rules';
import type { LlmMessage } from '../../src/llm/task';
import {
  LlmRecordingSchema,
  RecordingMissError,
  recordingPath,
  type LlmRecording,
  type LlmTransport,
  type TransportRequest,
  type TransportResponse,
} from '../../src/llm/transport';
import { inputHash, schemaInstruction, type AiResponseMode } from '../../src/llm/wire';

/** Committed recordings: `fixtures/llm-recordings/{taskId}/{inputHash16}.json`. */
export const RECORDINGS_DIR = fileURLToPath(
  new URL('../../../../fixtures/llm-recordings/', import.meta.url),
);

/** Replay description stored next to the recording (extra keys, written by scripts/src/record). */
export interface RecordedRequest {
  task: LlmRecording['taskId'];
  sample: string | null;
  candidates: AiCandidate[];
  rule_texts: string[];
  mode: AiResponseMode;
}

export interface RecordingFile {
  path: string;
  case: string;
  request: RecordedRequest;
  recording: LlmRecording;
}

/** Forwarded messages for a recorded request (same rule as the record script and the Worker). */
export function messagesFor(r: RecordedRequest): LlmMessage[] {
  const task = TASKS[r.task];
  const msgs = task.buildMessages({ candidates: r.candidates }, selectInjectedRules(r.rule_texts));
  return r.mode === 'json_object' ? [...msgs, schemaInstruction(task)] : msgs;
}

/** Every recording on disk, schema-validated. */
export function loadRecordings(dir: string = RECORDINGS_DIR): RecordingFile[] {
  const out: RecordingFile[] = [];
  for (const task of Object.keys(TASKS)) {
    let files: string[];
    try {
      files = readdirSync(join(dir, task));
    } catch {
      continue;
    }
    for (const f of files.filter((x) => x.endsWith('.json')).sort()) {
      const path = join(dir, task, f);
      const json = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
      out.push({
        path,
        case: String(json['case']),
        request: json['request'] as RecordedRequest,
        recording: LlmRecordingSchema.parse(json),
      });
    }
  }
  return out;
}

export function recordingByCase(id: string, dir?: string): RecordingFile {
  const hit = loadRecordings(dir).find((r) => r.case === id);
  if (!hit) throw new Error(`no recording for case ${id}`);
  return hit;
}

/**
 * Replays committed recordings. No network: it never calls fetch. A request whose inputHash (or
 * task / promptVersion) has no recording throws RecordingMissError, so prompt drift fails loudly.
 */
export class RecordedTransport implements LlmTransport {
  readonly calls: TransportRequest[] = [];
  constructor(private readonly dir: string = RECORDINGS_DIR) {}

  send(req: TransportRequest): Promise<TransportResponse> {
    this.calls.push(req);
    let rec: LlmRecording;
    try {
      const json = JSON.parse(
        readFileSync(join(this.dir, recordingPath(req.taskId, req.inputHash)), 'utf8'),
      ) as unknown;
      rec = LlmRecordingSchema.parse(json);
    } catch {
      return Promise.reject(new RecordingMissError(req.inputHash));
    }
    if (
      rec.inputHash !== req.inputHash ||
      rec.taskId !== req.taskId ||
      rec.promptVersion !== req.promptVersion
    )
      return Promise.reject(new RecordingMissError(req.inputHash));
    return Promise.resolve({
      raw: rec.response.raw,
      parsed: rec.response.parsed,
      servedModel: rec.meta.served_model,
      ...(rec.meta.tokens
        ? { usage: { tokens_in: rec.meta.tokens.in, tokens_out: rec.meta.tokens.out } }
        : {}),
    });
  }
}

/** Build a TransportRequest for a recorded request (messages + inputHash from core). */
export function transportRequest(r: RecordedRequest, model: string): TransportRequest {
  const messages = messagesFor(r);
  return {
    taskId: r.task,
    promptVersion: TASKS[r.task].promptVersion,
    model,
    messages,
    inputHash: inputHash(messages),
  };
}
