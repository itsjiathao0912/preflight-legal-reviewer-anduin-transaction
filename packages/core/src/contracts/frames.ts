import { z } from 'zod';
import { ErrorDetailSchema } from './errors';
import { AiResultSchema } from './ai';
import { OcrResultSchema } from './ocr';

/** NDJSON frames v1. Exactly one terminal frame (result|error), any number of hb before it. */
export const HeartbeatFrameSchema = z.object({ t: z.literal('hb') }).strict();

export const ResultFrameSchema = z.discriminatedUnion('kind', [
  z.object({
    t: z.literal('result'),
    kind: z.literal('ai'),
    data: AiResultSchema,
    cache: z.enum(['hit', 'miss']),
    model: z.string().min(1).max(120),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
  z.object({
    t: z.literal('result'),
    kind: z.literal('ocr'),
    data: OcrResultSchema,
    cache: z.enum(['hit', 'miss']),
    model: z.string().min(1).max(120),
    meta: z.record(z.string(), z.unknown()).optional(),
  }),
]);

/** Error frame = the shared ErrorDetail schema plus `t: 'error'`. */
export const ErrorFrameSchema = ErrorDetailSchema.extend({ t: z.literal('error') });

export const FrameSchema = z.union([HeartbeatFrameSchema, ResultFrameSchema, ErrorFrameSchema]);
export type Frame = z.infer<typeof FrameSchema>;
export type ResultFrame = z.infer<typeof ResultFrameSchema>;
export type ErrorFrame = z.infer<typeof ErrorFrameSchema>;

export class FrameParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FrameParseError';
  }
}

/** Parse one NDJSON line. Rejects malformed JSON and unknown `t`. */
export function parseFrameLine(line: string): Frame {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    throw new FrameParseError('frame is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || !('t' in raw))
    throw new FrameParseError('frame has no t');
  const t = (raw as { t: unknown }).t;
  if (t !== 'hb' && t !== 'result' && t !== 'error')
    throw new FrameParseError(`unknown frame type ${String(t)}`);
  const r = FrameSchema.safeParse(raw);
  if (!r.success)
    throw new FrameParseError(`invalid ${t} frame: ${r.error.issues[0]?.message ?? 'schema'}`);
  return r.data;
}

export function isTerminal(f: Frame): f is ResultFrame | ErrorFrame {
  return f.t !== 'hb';
}

/** Parse a whole NDJSON body; enforces exactly one terminal frame, last. */
export function parseFrameStream(body: string): {
  heartbeats: number;
  terminal: ResultFrame | ErrorFrame;
} {
  const lines = body.split('\n').filter((l) => l.trim().length > 0);
  let heartbeats = 0;
  let terminal: ResultFrame | ErrorFrame | undefined;
  for (const line of lines) {
    const f = parseFrameLine(line);
    if (terminal) throw new FrameParseError('frame after terminal frame');
    if (isTerminal(f)) terminal = f;
    else heartbeats++;
  }
  if (!terminal) throw new FrameParseError('stream has no terminal frame');
  return { heartbeats, terminal };
}

export function frameLine(f: Frame): string {
  return JSON.stringify(FrameSchema.parse(f)) + '\n';
}
