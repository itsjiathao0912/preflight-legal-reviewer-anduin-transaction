// AC39: memory-route guards (Origin, x-aduin-client, JSON content type, 64 KB / 128 KB body caps),
// `no-store`, no CORS, frozen errorStatus; header guards run before the cookie check and any D1
// query; the cookie SIGNATURE is verified (no DB) before the body is read or parsed (review L5).
import { errorStatus } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { MEMORY_ROUTES } from '../../src/routes/memory/index';
import { call, makeMem, session } from './memory-harness';
import { answerBody, askQuestion } from './variance-harness';

const POSTS = MEMORY_ROUTES.filter((r) => r.startsWith('POST ')).map((r) =>
  r.slice(5).replace(':id', 'x1'),
);
const GETS = MEMORY_ROUTES.filter(
  (r) => r.startsWith('GET ') && r !== 'GET /api/memory/health',
).map(
  (r) =>
    r.slice(4).replace(':id', 'firm-x') +
    (r.endsWith('/rules') || r.endsWith('/firm')
      ? '?law_firm_id=firm-x'
      : r.endsWith('/audit')
        ? '?limit=1'
        : r.endsWith('/counsel/comments')
          ? '?question_id=x1'
          : r.endsWith('/counsel/sheet')
            ? '?doc_ref=package:hartwell'
            : ''),
);

function expectHeaders(res: Response) {
  expect(res.headers.get('cache-control')).toBe('no-store');
  for (const [k] of res.headers) expect(k.startsWith('access-control-')).toBe(false);
}

describe('memory-guards-matrix (AC39)', () => {
  test.each(POSTS)('POST %s: client header, Origin, content type, malformed JSON', async (path) => {
    const h = makeMem();
    const s = await session(h);
    h.resetStats();
    const cases: [Parameters<typeof call>[4], number, string][] = [
      [{ headers: { 'x-aduin-client': null } }, 400, 'client_header'],
      [{ headers: { origin: 'https://evil.test' } }, 400, 'origin'],
      [{ headers: { origin: null } }, 400, 'origin'],
      [{ headers: { 'sec-fetch-site': 'cross-site' } }, 400, 'origin'],
      [{ headers: { 'content-type': 'text/plain' } }, 415, 'content_type'],
      [{ raw: '{not json', cookie: s.cookie }, 400, 'malformed_json'],
      [{ raw: '[1,2]', cookie: s.cookie }, 400, 'malformed_json'],
    ];
    for (const [o, status, reason] of cases) {
      const r = await call(h, 'POST', path, {}, o);
      expect(r.status, `${path} ${reason}`).toBe(status);
      expect(r.body.error.reason).toBe(reason);
      expect(errorStatus(r.body.error.code)).toBe(status);
      expectHeaders(r.res);
      expect(r.res.headers.get('set-cookie')).toBeNull();
    }
    expect(h.stats.queries).toBe(0); // no D1 query before the guards pass
  });

  test.each(POSTS)('POST %s: body cap', async (path) => {
    const h = makeMem();
    const s = await session(h);
    const cap = path.endsWith('/findings') ? 128 * 1024 : 64 * 1024;
    const big = await call(h, 'POST', path, undefined, {
      raw: JSON.stringify({ pad: 'x'.repeat(cap) }),
      cookie: s.cookie,
    });
    expect(big.status).toBe(413);
    expect(big.body.error.code).toBe('payload_too_large');
    expectHeaders(big.res);
  });

  // POST /api/counsel/join is cookieless by design (the share token in the body is the credential;
  // its 401s are covered by counsel-share-token).
  test.each(
    POSTS.filter(
      (p) => p !== '/api/session' && p !== '/api/session/reset' && p !== '/api/counsel/join',
    ),
  )('POST %s: a missing or forged cookie is 401 before the body is read (L5)', async (path) => {
    const h = makeMem();
    for (const cookie of [undefined, '__Host-aduin_v=forged.sig']) {
      const r = await call(h, 'POST', path, undefined, {
        raw: JSON.stringify({ pad: 'x'.repeat(200 * 1024) }),
        ...(cookie ? { cookie } : {}),
      });
      expect(r.status, path).toBe(401);
      expect(r.body.error.code).toBe('invalid_session');
    }
    expect(h.stats.queries).toBe(0);
  });

  test('findings chunks accept bodies between 64 KB and 128 KB (then fail auth, not size)', async () => {
    const h = makeMem();
    const r = await call(h, 'POST', '/api/runs/x1/findings', undefined, {
      raw: JSON.stringify({ pad: 'x'.repeat(100 * 1024) }),
    });
    expect(r.status).toBe(401);
  });

  test.each(GETS)('GET %s requires x-aduin-client', async (path) => {
    const h = makeMem();
    const s = await session(h);
    const r = await call(h, 'GET', path, undefined, {
      cookie: s.cookie,
      headers: { 'x-aduin-client': null },
    });
    expect(r.status).toBe(400);
    expect(r.body.error.reason).toBe('client_header');
    expectHeaders(r.res);
    const okr = await call(h, 'GET', path, undefined, { cookie: s.cookie });
    // counsel comments of an unknown question: a typed 400 after the guards (never 200 / 5xx)
    if (path.includes('/counsel/comments')) {
      expect(okr.status, path).toBe(400);
      expect(okr.body.error.reason).toBe('question_not_found');
    } else expect(okr.status, path).toBe(200);
    expectHeaders(okr.res);
  });

  test('schema-invalid bodies are 400 invalid_request; successes are no-store without CORS', async () => {
    const h = makeMem();
    const s = await session(h);
    const r = await call(
      h,
      'POST',
      '/api/memory/lookup',
      { law_firm_id: 'firm-x', fingerprints: ['nothex'] },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(400);
    expect(r.body.error).toMatchObject({ code: 'invalid_request', reason: 'schema' });
    const tooMany = await call(
      h,
      'POST',
      '/api/memory/lookup',
      { law_firm_id: 'firm-x', fingerprints: Array.from({ length: 201 }, () => 'a'.repeat(64)) },
      { cookie: s.cookie },
    );
    expect(tooMany.status).toBe(400);
  });

  test('variance: forged scope / assertion shapes on counsel answers are 400 invalid_request', async () => {
    const h = makeMem();
    const s = await session(h);
    const q = await askQuestion(h, s, { firm: 'hartwell-crane' });
    for (const extra of [
      { scope: 'firm_template' },
      { assertion: { kind: 'scope_exists', label: 'Appendix C' } },
      { scope: 'firm_template', intent: 'x', assertion: { kind: 'scope_exists' } },
      {
        scope: 'firm_template',
        intent: 'x',
        assertion: { kind: 'scope_exists', label: 'L'.repeat(81) },
      },
      { scope: 'firm_template', intent: 'x', assertion: 'Appendix C' },
    ]) {
      const r = await call(h, 'POST', '/api/counsel/answers', answerBody(q, extra), {
        cookie: s.cookie,
      });
      expect(r.status, JSON.stringify(extra)).toBe(400);
      expect(r.body.error.code).toBe('invalid_request');
      expectHeaders(r.res);
    }
  });
});
