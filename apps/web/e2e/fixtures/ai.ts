import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, type Page, type Request, type Route } from '@playwright/test';

/**
 * Phase 05 AI-lane helpers for the preview project. The preview build has no Worker, so the lane is
 * switched on through the e2e-only `__aduinE2E.setApiBase('/')` hook (G16) and every `/api/ai` and
 * `/api/quota` call is answered by route interception (from the committed recordings where a real
 * answer is needed). Any request to openrouter.ai is aborted and recorded.
 */
const ROOT = resolve(import.meta.dirname, '..', '..', '..', '..');
const REC = resolve(ROOT, 'fixtures', 'llm-recordings', 'clause-judgment');
export const MODEL = 'nvidia/nemotron-3-super-120b-a12b:free';

export interface Recording {
  case: string;
  model: string;
  request: { candidates: { id: string; quote: string }[] };
  response: { raw: string; parsed: { findings: Record<string, unknown>[] } };
  meta: { served_model: string };
}

export function recording(caseId: string): Recording {
  for (const n of readdirSync(REC)) {
    const j = JSON.parse(readFileSync(resolve(REC, n), 'utf8')) as Recording;
    if (j.case === caseId) return j;
  }
  throw new Error(`no recording ${caseId}`);
}

/** NDJSON body: frames joined by newlines (the Worker's wire shape). */
export function ndjson(...frames: unknown[]): string {
  return frames.map((f) => JSON.stringify(f)).join('\n') + '\n';
}

export const hb = { t: 'hb' } as const;

export function resultFrame(findings: unknown[], cache: 'hit' | 'miss' = 'miss', model = MODEL) {
  return { t: 'result', kind: 'ai', data: { v: 1, findings }, cache, model };
}

export function errorFrame(code: string, reason?: string, retry_after_s?: number) {
  return {
    t: 'error',
    code,
    message: 'Refused.',
    ...(reason ? { reason } : {}),
    ...(retry_after_s !== undefined ? { retry_after_s } : {}),
  };
}

export interface AiCall {
  body: {
    v: number;
    task: string;
    law_firm_id: string | null;
    candidates: { id: string; quote: string }[];
  };
  headers: Record<string, string>;
}

export type AiReply =
  | { kind: 'stream'; body: string }
  | { kind: 'http'; status: number; code: string; reason?: string; retry_after_s?: number };

/** Answer /api/ai with `reply(call, n)`; returns the recorded calls. */
export async function interceptAi(
  page: Page,
  reply: (call: AiCall, n: number) => AiReply,
): Promise<AiCall[]> {
  const calls: AiCall[] = [];
  await page.route('**/api/ai', async (route: Route, req: Request) => {
    const call: AiCall = { body: req.postDataJSON() as AiCall['body'], headers: req.headers() };
    calls.push(call);
    const r = reply(call, calls.length);
    if (r.kind === 'stream') {
      await route.fulfill({
        status: 200,
        headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' },
        body: r.body,
      });
    } else {
      await route.fulfill({
        status: r.status,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
        body: JSON.stringify({
          error: {
            code: r.code,
            message: 'Refused.',
            ...(r.reason ? { reason: r.reason } : {}),
            ...(r.retry_after_s !== undefined ? { retry_after_s: r.retry_after_s } : {}),
          },
        }),
      });
    }
  });
  return calls;
}

/** Fail-closed /api/ai: any call is recorded (the test asserts zero) and refused. */
export async function forbidAi(page: Page): Promise<AiCall[]> {
  return interceptAi(page, () => ({ kind: 'http', status: 500, code: 'upstream_failed' }));
}

/** Answer /api/quota (asserts the client header); returns the call count holder. */
export async function interceptQuota(
  page: Page,
  q: { used?: number; limit?: number; status?: number } = {},
): Promise<{ calls: number; headerOk: boolean }> {
  const seen = { calls: 0, headerOk: true };
  await page.route('**/api/quota', async (route: Route, req: Request) => {
    seen.calls++;
    if (req.headers()['x-aduin-client'] !== '1') seen.headerOk = false;
    if (q.status && q.status !== 200) {
      await route.fulfill({ status: q.status, body: '' });
      return;
    }
    const resets_at = Math.floor(Date.now() / 1000) + 3600;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      body: JSON.stringify({
        ai: { used: q.used ?? 0, limit: q.limit ?? 3, resets_at },
        ocr_pages: { used: 0, limit: 20, resets_at },
        global_ok: true,
      }),
    });
  });
  return seen;
}

/** Abort and record any browser request to openrouter.ai. */
export async function blockOpenRouter(page: Page): Promise<string[]> {
  const hits: string[] = [];
  await page.route(/openrouter\.ai/i, async (route) => {
    hits.push(route.request().url());
    await route.abort();
  });
  return hits;
}

/** Switch the AI lane on (G16 e2e hook). Call after gotoApp and before opening a document. */
export async function enableLane(page: Page) {
  await page.evaluate(() =>
    (
      window as unknown as { __aduinE2E: { setApiBase: (b: string) => void } }
    ).__aduinE2E.setApiBase('/'),
  );
}

export const aiRows = (page: Page) =>
  page.getByTestId('finding-row').filter({ hasText: 'AI suggestion' });

/** A model finding built from a posted candidate (its quote is the document's own sentence). */
export function findingFor(c: { id: string; quote: string }, i = 0) {
  return {
    candidate_id: c.id,
    issue_class: 'ambiguity',
    severity: 'medium',
    confidence: 0.6,
    quote: c.quote,
    explanation: `Test AI note ${i + 1}: the wording leaves two readings open.`,
  };
}

export async function expectStage(page: Page, text: RegExp) {
  await expect(page.getByTestId('stage-status-button')).toHaveText(text, { timeout: 15_000 });
}
