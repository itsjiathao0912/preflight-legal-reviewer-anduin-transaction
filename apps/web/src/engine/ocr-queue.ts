import { limits } from '@aduin/core';
import { apiUrl } from '../api/base';
import { clientHeaders, DOC_HEADER, TURNSTILE_HEADER } from '../api/http';
import { postNdjson, type StreamTerminal } from '../api/ndjson';
import { fetchQuota } from '../api/quota';
import { turnstileToken } from '../features/ai/turnstile';
import { appDb } from '../storage/db';
import { imageKindOf, RENDER_PARAMS, type RenderedPage } from './render-pages';
import type { OcrPageInput } from './types';

/**
 * Browser OCR queue (Phase 06 C2/D3/D5). Up to 3 pages in flight, per-page progress, resumable.
 * Lookup order per page: static precomputed index -> browser cache (Dexie) -> POST /api/ocr
 * (Phase 05 shared NDJSON client, `x-aduin-client: 1`, same-origin cookie). Only downscaled JPEG/PNG
 * page images are ever posted: a PDF (or anything that is not a JPEG/PNG) is refused before any
 * request (`ocr-never-sends-pdf`). With no API base ('' = preview build) pages are `unavailable`.
 *
 * Cache key per page (Public Contracts):
 *   sha256("ocr|" sourceHash "|" pageIndex "|" params "|" model "|" promptVer "|" schemaVer)
 * where sourceHash is the hash of the ORIGINAL source bytes (canvas output is not deterministic).
 * Hashing uses WebCrypto; no @aduin/core values beyond `limits` (import-graph rule).
 */

export const OCR_CONCURRENCY = 3;
/** Default free vision model (Worker AI_VISION_MODELS); part of the cache key. */
export const OCR_MODEL = 'nvidia/nemotron-3.5-super-vl:free';
export const OCR_PROMPT_VER = 'ocr2';
export const OCR_SCHEMA_VER = 's1';
export const OCR_UNAVAILABLE_BUILD = 'OCR unavailable in this build';
export const OCR_UNAVAILABLE_LIMIT = 'OCR page limit reached for today';
export const OCR_UNAVAILABLE_SERVICE = 'OCR is not available right now';
/** Review F2: page images follow the AI consent switch; AI off -> no fresh /api/ocr call. */
export const OCR_UNAVAILABLE_AI_OFF = 'Text reading is off while AI review is off';
const PRECOMPUTED_INDEX = '/precomputed/ocr/index.json';
const MAX_LINES = 400;
const MAX_LINE_CHARS = 4000;

const HEX = (b: ArrayBuffer) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Hex SHA-256 via WebCrypto. */
export async function sha256Hex(data: Uint8Array | string): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return HEX(await crypto.subtle.digest('SHA-256', bytes.slice()));
}

export function ocrKeyParts(sourceHash: string, pageIndex: number, params = RENDER_PARAMS) {
  return ['ocr', sourceHash, String(pageIndex), params, OCR_MODEL, OCR_PROMPT_VER, OCR_SCHEMA_VER];
}

export async function ocrPageKey(
  sourceHash: string,
  pageIndex: number,
  params = RENDER_PARAMS,
): Promise<string> {
  return sha256Hex(ocrKeyParts(sourceHash, pageIndex, params).join('|'));
}

export type OcrLines = NonNullable<OcrPageInput['lines']>;

/** Browser cache port (default: Dexie `parsedModels`, purged with uploads after 24 h). */
export interface OcrCache {
  get(key: string): Promise<OcrLines | null>;
  put(key: string, lines: OcrLines): Promise<void>;
}

export function dexieOcrCache(): OcrCache | null {
  const db = appDb();
  if (!db) return null;
  return {
    async get(key) {
      try {
        const row = await db.parsedModels.get(`ocr:${key}`);
        return row ? sanitizeLines((row.model as { lines?: unknown } | null)?.lines) : null;
      } catch {
        return null;
      }
    },
    async put(key, lines) {
      try {
        await db.parsedModels.put({
          docHash: `ocr:${key}`,
          createdAt: Date.now(),
          model: { lines },
        });
      } catch {
        /* cache is best effort */
      }
    },
  };
}

function num01(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1 ? v : undefined;
}

/**
 * Minimal shape check of OCR lines from any source (precomputed file, cache, Worker). The engine
 * worker re-checks through the core adapter; this keeps hostile data bounded on the way in.
 */
export function sanitizeLines(raw: unknown): OcrLines | null {
  if (!Array.isArray(raw)) return null;
  const out: OcrLines = [];
  for (const l of raw.slice(0, MAX_LINES)) {
    if (!l || typeof l !== 'object') continue;
    const o = l as Record<string, unknown>;
    if (typeof o['text'] !== 'string') continue;
    const line: OcrLines[number] = { text: o['text'].slice(0, MAX_LINE_CHARS) };
    const b = o['bbox'] as Record<string, unknown> | undefined;
    if (b && typeof b === 'object') {
      const x = b['x'];
      const y = b['y'];
      const w = b['w'];
      const h = b['h'];
      if ([x, y, w, h].every((n) => typeof n === 'number' && Number.isFinite(n)))
        line.bbox = { x: x as number, y: y as number, w: w as number, h: h as number };
    }
    const conf = num01(o['conf']);
    if (conf !== undefined) line.conf = conf;
    out.push(line);
  }
  return out;
}

/** Lines of the first page of an OcrResult-shaped value (`{result}` wrapper accepted). */
export function linesOfResult(data: unknown): OcrLines | null {
  if (!data || typeof data !== 'object') return null;
  const o = data as Record<string, unknown>;
  const r = (o['result'] && typeof o['result'] === 'object' ? o['result'] : o) as Record<
    string,
    unknown
  >;
  const pages = r['pages'];
  if (!Array.isArray(pages) || pages.length === 0) return null;
  const p = pages[0] as Record<string, unknown> | null;
  return p ? sanitizeLines(p['lines']) : null;
}

/** Static precomputed lookup: index.json `{sampleId: [{page, file, key}]}` -> key -> file. */
export async function loadPrecomputedIndex(
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const res = await fetchFn(PRECOMPUTED_INDEX);
    if (!res.ok) return map;
    const idx = (await res.json()) as unknown;
    if (!idx || typeof idx !== 'object') return map;
    for (const list of Object.values(idx as Record<string, unknown>)) {
      if (!Array.isArray(list)) continue;
      for (const e of list) {
        const o = e as Record<string, unknown> | null;
        const key = o?.['key'];
        const file = o?.['file'];
        if (
          typeof key === 'string' &&
          /^[0-9a-f]{64}$/.test(key) &&
          typeof file === 'string' &&
          /^[A-Za-z0-9._-]{1,120}$/.test(file)
        )
          map.set(key, file);
      }
    }
  } catch {
    /* no precomputed set */
  }
  return map;
}

/** Base64 of bytes (chunked; no data URL prefix). */
export function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/** Thrown before any request when a page payload is not a JPEG/PNG image. */
export class NotAnImageError extends Error {
  constructor() {
    super('Only page images are sent to OCR.');
    this.name = 'NotAnImageError';
  }
}

/**
 * Build the /api/ocr request body for one rendered page. Refuses anything that is not a JPEG/PNG
 * (a PDF can never be sent) and anything over limits.ocrBodyBytes.
 */
export async function buildOcrBody(
  pageIndex: number,
  image: Blob,
): Promise<{
  v: 1;
  mime: 'image/jpeg' | 'image/png';
  pages: { index: number; data_b64: string }[];
}> {
  const bytes = new Uint8Array(await image.arrayBuffer());
  const kind = imageKindOf(bytes);
  if (!kind) throw new NotAnImageError();
  const body = {
    v: 1 as const,
    mime: kind === 'jpeg' ? ('image/jpeg' as const) : ('image/png' as const),
    pages: [{ index: pageIndex, data_b64: toBase64(bytes) }],
  };
  if (JSON.stringify(body).length > limits.ocrBodyBytes) {
    throw new Error('The page image is too large to send.');
  }
  return body;
}

export interface OcrJob {
  /** 0-based page index in the document. */
  index: number;
  /** Original-bytes hash for this page's cache key (defaults to the queue sourceHash). */
  sourceHash?: string;
  /** Render this page to a downscaled JPEG (lazy: only called when a fresh call is needed). */
  render: () => Promise<RenderedPage>;
}

export interface OcrQueueOptions {
  sourceHash: string;
  jobs: readonly OcrJob[];
  /** Pages already done (resume): kept as-is, never re-requested. */
  previous?: readonly OcrPageInput[];
  concurrency?: number;
  onProgress?: (pages: OcrPageInput[]) => void;
  signal?: AbortSignal;
  /**
   * AI review is off: never send page images (and skip the quota call). Precomputed static
   * results and the local cache still apply - they are not egress. Read before EACH page, so
   * switching AI off mid-run stops the remaining pages (review N3).
   */
  aiOff?: () => boolean;
  fetchFn?: typeof fetch;
  cache?: OcrCache | null;
  /** Precomputed key -> file map (default: fetched from /precomputed/ocr/index.json). */
  precomputed?: Map<string, string>;
  /** Fresh OCR pages the visitor may still use today (default: GET /api/quota). */
  freePagesLeft?: number | null;
}

function unavailableReason(t: Extract<StreamTerminal, { kind: 'error' }>): string | null {
  const c = t.error.code;
  if (c === 'quota_exhausted' || c === 'budget_cap' || c === 'rate_limited')
    return t.error.reason === 'visitor_limit' || c === 'rate_limited'
      ? OCR_UNAVAILABLE_LIMIT
      : OCR_UNAVAILABLE_SERVICE;
  return null;
}

/** Run OCR over the jobs; resolves with one OcrPageInput per job (never throws). */
export async function runOcrQueue(opts: OcrQueueOptions): Promise<OcrPageInput[]> {
  const fetchFn = opts.fetchFn ?? fetch;
  const pages = new Map<number, OcrPageInput>();
  for (const j of opts.jobs) pages.set(j.index, { index: j.index, state: 'queued' });
  for (const p of opts.previous ?? [])
    if (p.state === 'done' && pages.has(p.index)) pages.set(p.index, { ...p });
  const emit = () => opts.onProgress?.([...pages.values()].sort((a, b) => a.index - b.index));
  emit();

  const url = apiUrl('api/ocr');
  const cache = opts.cache === undefined ? dexieOcrCache() : opts.cache;
  const precomputed = opts.precomputed ?? (await loadPrecomputedIndex(fetchFn));
  let freeLeft: number | null =
    opts.freePagesLeft !== undefined
      ? opts.freePagesLeft
      : url && !opts.aiOff?.()
        ? await fetchQuota(fetchFn).then((q) =>
            q ? Math.max(0, q.ocrPages.limit - q.ocrPages.used) : null,
          )
        : null;

  const set = (p: OcrPageInput) => {
    pages.set(p.index, p);
    emit();
  };

  const one = async (job: OcrJob): Promise<void> => {
    if (pages.get(job.index)?.state === 'done') return;
    if (opts.signal?.aborted) return set({ index: job.index, state: 'queued' });
    set({ index: job.index, state: 'running' });
    const key = await ocrPageKey(job.sourceHash ?? opts.sourceHash, job.index);

    const file = precomputed.get(key);
    if (file) {
      try {
        const res = await fetchFn(`/precomputed/ocr/${file}`);
        const lines = res.ok ? linesOfResult(await res.json()) : null;
        if (lines) return set({ index: job.index, state: 'done', lines });
      } catch {
        /* fall through to cache / API */
      }
    }
    const cached = cache ? await cache.get(key) : null;
    if (cached) return set({ index: job.index, state: 'done', lines: cached });

    if (opts.aiOff?.())
      return set({ index: job.index, state: 'unavailable', reason: OCR_UNAVAILABLE_AI_OFF });
    if (!url) return set({ index: job.index, state: 'unavailable', reason: OCR_UNAVAILABLE_BUILD });
    if (freeLeft !== null && freeLeft <= 0)
      return set({ index: job.index, state: 'unavailable', reason: OCR_UNAVAILABLE_LIMIT });
    if (freeLeft !== null) freeLeft--;

    let body: Awaited<ReturnType<typeof buildOcrBody>>;
    try {
      const rendered = await job.render();
      body = await buildOcrBody(job.index, rendered.jpeg);
    } catch (e) {
      return set({
        index: job.index,
        state: 'failed',
        reason: e instanceof Error ? e.message.slice(0, 120) : 'The page could not be prepared.',
      });
    }
    const token = await turnstileToken({ interactive: true });
    const t = await postNdjson(url, body, {
      headers: clientHeaders({
        [DOC_HEADER]: opts.sourceHash,
        ...(token ? { [TURNSTILE_HEADER]: token } : {}),
      }),
      ...(opts.signal ? { signal: opts.signal } : {}),
      fetchFn,
    });
    if (t.kind === 'aborted') return set({ index: job.index, state: 'queued' });
    if (t.kind === 'error') {
      const unavailable = unavailableReason(t);
      if (unavailable) {
        freeLeft = 0;
        return set({ index: job.index, state: 'unavailable', reason: unavailable });
      }
      return set({ index: job.index, state: 'failed', reason: t.error.message.slice(0, 120) });
    }
    const lines = linesOfResult(t.data);
    if (!lines)
      return set({
        index: job.index,
        state: 'failed',
        reason: 'The OCR answer could not be read.',
      });
    if (cache) await cache.put(key, lines);
    set({ index: job.index, state: 'done', lines });
  };

  const queue = [...opts.jobs];
  const n = Math.max(1, Math.min(opts.concurrency ?? OCR_CONCURRENCY, OCR_CONCURRENCY));
  await Promise.all(
    Array.from({ length: Math.min(n, queue.length) }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          await one(job);
        } catch {
          set({ index: job.index, state: 'failed', reason: 'The page could not be read.' });
        }
      }
    }),
  );
  return [...pages.values()].sort((a, b) => a.index - b.index);
}
