// Request guards (run before ANY claim, cache read, Turnstile or upstream call):
// method, client header, Origin (CSRF), content-type, size caps (content-length AND streamed
// read), JSON parse, field whitelist/shaping and image-part checks.
import {
  AiRequestSchema,
  OcrRequestSchema,
  limits,
  type AiRequest,
  type AiTaskId,
} from '@aduin/core';
import { ProxyError } from './errors';

/** Client fields the server sets itself: a client sending any of them is rejected (400). */
export const FORBIDDEN_FIELDS = [
  'model',
  'models',
  'plugins',
  'provider',
  'tools',
  'tool_choice',
  'max_tokens',
  'max_completion_tokens',
  'temperature',
  'response_format',
  'messages',
  'route',
  'transforms',
] as const;

export const BODY_CAPS = {
  ai: limits.aiBodyBytes,
  ocr: limits.ocrBodyBytes,
  other: limits.otherBodyBytes,
} as const;

export function checkClientHeader(request: Request): void {
  if (request.headers.get('x-aduin-client') !== '1')
    throw new ProxyError('invalid_request', 'client_header');
}

/** Mutating calls must carry an Origin equal to the Worker's own origin. */
export function checkOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  const own = new URL(request.url).origin;
  if (!origin || origin !== own) throw new ProxyError('invalid_request', 'origin');
  const site = request.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') throw new ProxyError('invalid_request', 'origin');
}

export function checkJsonContentType(request: Request): void {
  const ct = (request.headers.get('content-type') ?? '').toLowerCase();
  const media = ct.split(';')[0]!.trim();
  if (media !== 'application/json') throw new ProxyError('unsupported_type', 'content_type');
}

/** Read the body as UTF-8 text, enforcing the cap on content-length and on the streamed bytes. */
export async function readBodyCapped(request: Request, cap: number): Promise<string> {
  const cl = request.headers.get('content-length');
  if (cl !== null) {
    if (!/^\d{1,12}$/.test(cl)) throw new ProxyError('invalid_request', 'content_length');
    if (Number(cl) > cap) throw new ProxyError('payload_too_large');
  }
  if (!request.body) throw new ProxyError('invalid_request', 'empty_body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel().catch(() => {});
      throw new ProxyError('payload_too_large');
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(all);
  } catch {
    throw new ProxyError('invalid_request', 'encoding');
  }
}

export function parseJsonObject(text: string): Record<string, unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ProxyError('invalid_request', 'malformed_json');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new ProxyError('invalid_request', 'malformed_json');
  return raw as Record<string, unknown>;
}

function rejectForbidden(obj: Record<string, unknown>): void {
  for (const f of FORBIDDEN_FIELDS)
    if (Object.prototype.hasOwnProperty.call(obj, f))
      throw new ProxyError('invalid_request', 'forbidden_field');
}

export interface ShapedAi {
  /** registry task id (Phase 05; schema default `clause-judgment`) */
  task: AiTaskId;
  law_firm_id: string | null;
  candidates: AiRequest['candidates'];
  /** server-side tier name; never a model id */
  tier: 'default';
}

/** Shape the AI envelope to the whitelist. `ext` and unknown optional fields are dropped. */
export function shapeAi(raw: Record<string, unknown>): ShapedAi {
  rejectForbidden(raw);
  const settings = raw['settings'];
  if (typeof settings === 'object' && settings !== null && !Array.isArray(settings))
    rejectForbidden(settings as Record<string, unknown>);
  const r = AiRequestSchema.safeParse(raw);
  if (!r.success) throw new ProxyError('invalid_request', 'schema');
  return {
    task: r.data.task,
    law_firm_id: r.data.law_firm_id,
    candidates: r.data.candidates.map((c) => ({
      id: c.id,
      quote: c.quote,
      section_path: c.section_path,
      ...(c.issue_class_hint ? { issue_class_hint: c.issue_class_hint } : {}),
    })),
    tier: 'default',
  };
}

export interface ShapedOcr {
  mime: 'image/png' | 'image/jpeg';
  pages: { index: number; data_b64: string }[];
}

const B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const DATA_URL = /^data:image\/(png|jpeg|webp);base64,/;

/** Normalize an image payload: raw base64, or a data:image/(png|jpeg|webp);base64 URL only. */
export function imageBase64(s: string): string {
  let b = s;
  if (b.startsWith('data:')) {
    const m = DATA_URL.exec(b);
    if (!m) throw new ProxyError('invalid_request', 'image_url');
    b = b.slice(m[0].length);
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(b)) {
    // http(s), file, blob, ... : never fetched by us or by the provider (no SSRF)
    throw new ProxyError('invalid_request', 'image_url');
  }
  if (b.length === 0 || b.length % 4 !== 0 || !B64.test(b))
    throw new ProxyError('invalid_request', 'image_data');
  return b;
}

/** OCR: images only. `application/pdf` -> 415 before any cache read, Turnstile or claim. */
export function shapeOcr(raw: Record<string, unknown>): ShapedOcr {
  rejectForbidden(raw);
  const mime = raw['mime'];
  if (mime !== 'image/png' && mime !== 'image/jpeg')
    throw new ProxyError('unsupported_type', 'mime');
  const r = OcrRequestSchema.safeParse(raw);
  if (!r.success) throw new ProxyError('invalid_request', 'schema');
  return {
    mime,
    pages: r.data.pages.map((p) => ({ index: p.index, data_b64: imageBase64(p.data_b64) })),
  };
}
