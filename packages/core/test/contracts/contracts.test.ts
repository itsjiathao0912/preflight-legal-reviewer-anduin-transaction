import { describe, expect, expectTypeOf, it } from 'vitest';
import { z } from 'zod';
import * as ai from '../../src/contracts/ai';
import * as cacheKeyMod from '../../src/contracts/cache-key';
import * as claims from '../../src/contracts/claims';
import * as errors from '../../src/contracts/errors';
import * as frames from '../../src/contracts/frames';
import * as memory from '../../src/contracts/memory';
import * as ocr from '../../src/contracts/ocr';
import * as quota from '../../src/contracts/quota';
import * as seed from '../../src/contracts/seed-spec';
import * as findings from '../../src/findings/schema';
import * as model from '../../src/model/types';
import type {
  CachePort,
  LedgerPort,
  PlatformPort,
  QuotaPort,
  RulesPort,
  TurnstilePort,
  QuotaClaimResult,
} from '../../src/contracts/ports';
import { analyzed } from '../helpers/samples';

const MODULES: Record<string, Record<string, unknown>> = {
  ai,
  cacheKey: cacheKeyMod,
  claims,
  errors,
  frames,
  memory,
  ocr,
  quota,
  seed,
  findings,
  model,
};

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .map((k) => [k, sortKeys((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

function exportedSchemas(): Array<[string, z.ZodType]> {
  const out: Array<[string, z.ZodType]> = [];
  for (const [mod, exports] of Object.entries(MODULES)) {
    for (const [name, value] of Object.entries(exports)) {
      if (value instanceof z.ZodType && name.endsWith('Schema'))
        out.push([`${mod}.${name}`, value]);
    }
  }
  return out.sort((a, b) => (a[0] < b[0] ? -1 : 1));
}

const FP = 'f'.repeat(64);
const decision = {
  id: 'dec_1',
  fingerprint: FP,
  status: 'active',
  decision: 'dismissed',
  reason_code: 'firm_standard_wording',
  fund_name: 'Fund I',
  decided_by_name: 'Analyst A',
  decided_at: 1_800_000_000,
} as const;

describe('contracts-json-schema-snapshot (freeze v1)', () => {
  it('every exported contract schema is captured in the committed JSON-schema snapshot', async () => {
    const all = exportedSchemas();
    expect(all.length).toBeGreaterThanOrEqual(40);
    const snap = Object.fromEntries(
      all.map(([name, s]) => [
        name,
        sortKeys(z.toJSONSchema(s, { unrepresentable: 'any', io: 'input' })),
      ]),
    );
    await expect(JSON.stringify(snap, null, 2) + '\n').toMatchFileSnapshot(
      '../__snapshots__/contracts.json-schema.snap',
    );
  });
});

describe('contract fixtures round-trip', () => {
  const finding = analyzed(1).findings[0]!;
  const cases: Array<[string, z.ZodType, unknown]> = [
    ['Finding', findings.FindingSchema, finding],
    ['FindingWire', findings.FindingWireSchema, findings.toWire(finding, FP)],
    ['ActiveDecision', memory.ActiveDecisionSchema, decision],
    [
      'MemoryLookupRequest',
      memory.MemoryLookupRequestSchema,
      { law_firm_id: 'firm-x', fingerprints: [FP] },
    ],
    ['MemoryLookupResponse', memory.MemoryLookupResponseSchema, { decisions: [decision] }],
    [
      'CreateRunRequest',
      memory.CreateRunRequestSchema,
      {
        client_op_id: 'op_12345678',
        doc_name: 'a.htm',
        doc_hash: FP,
        law_firm_id: null,
        settings_hash: FP,
      },
    ],
    [
      'StoreFindingsRequest',
      memory.StoreFindingsRequestSchema,
      { client_op_id: 'op_12345678', findings: [findings.toWire(finding, FP)] },
    ],
    [
      'CreateDecisionRequest',
      memory.CreateDecisionRequestSchema,
      {
        client_op_id: 'op_12345678',
        finding_ref: finding.id,
        decision: 'dismissed',
        reason_code: 'other',
        quote_text: finding.quote,
        fingerprint: FP,
        issue_class: finding.issue_class,
      },
    ],
    [
      'ConflictBody',
      memory.ConflictBodySchema,
      {
        error: { code: 'conflict_active_decision', message: 'already decided' },
        current: decision,
      },
    ],
    ['RevokeDecisionResponse', memory.RevokeDecisionResponseSchema, { ok: true, current: null }],
    [
      'CounselAnswerRequest',
      memory.CounselAnswerRequestSchema,
      {
        client_op_id: 'op_12345678',
        question_id: 'q1',
        option: 'unclear',
        quote_text: 'x',
        fingerprint: FP,
      },
    ],
    [
      'FirmMemoryResponse',
      memory.FirmMemoryResponseSchema,
      {
        decisions: [decision],
        rules: [{ id: 'r1', text: 'x', status: 'proposed', origin: 'proposal', evidence_count: 3 }],
        counts: {
          decisions: 1,
          dismissed: 1,
          answered: 0,
          awaiting: 0,
          rules_active: 0,
          rules_proposed: 1,
        },
      },
    ],
    [
      'AuditResponse',
      memory.AuditResponseSchema,
      { events: [{ id: 'e1', at: 1, actor_name: 'A', action: 'decision_recorded' }] },
    ],
    [
      'ExportResponse',
      memory.ExportResponseSchema,
      { export_version: 1, decisions: [], rules: [], audit: [] },
    ],
    [
      'CreateSession',
      claims.CreateSessionResponseSchema,
      { workspace_id: 'ws', analyst_id: 'an', kind: 'sandbox', expires_at: 2, read_only: false },
    ],
    [
      'SessionClaims',
      claims.SessionClaimsSchema,
      { v: 'vis', w: 'ws', a: 'an', iat: 1, exp: 2, kid: 'k1', t: 1000 },
    ],
    [
      'AiRequest',
      ai.AiRequestSchema,
      {
        v: 1,
        law_firm_id: null,
        candidates: [{ id: 'c1', quote: 'q', section_path: [] }],
        settings: {},
        ext: { future: true },
      },
    ],
    [
      'AiResult',
      ai.AiResultSchema,
      {
        v: 1,
        findings: [
          {
            candidate_id: 'c1',
            issue_class: 'ambiguity',
            severity: 'high',
            confidence: 0.5,
            quote: 'q',
            explanation: 'e',
          },
        ],
      },
    ],
    [
      'OcrRequest',
      ocr.OcrRequestSchema,
      { v: 1, mime: 'image/png', pages: [{ index: 0, data_b64: 'AAAA' }] },
    ],
    [
      'OcrResult',
      ocr.OcrResultSchema,
      { v: 1, pages: [{ index: 0, lines: [{ text: 'x', conf: 0.9 }] }] },
    ],
    [
      'Quota',
      quota.QuotaResponseSchema,
      {
        ai: { used: 0, limit: 3, resets_at: 1 },
        ocr_pages: { used: 0, limit: 6, resets_at: 1 },
        global_ok: true,
      },
    ],
    [
      'ErrorBody',
      errors.ErrorBodySchema,
      {
        error: {
          code: 'quota_exhausted',
          message: 'limit',
          reason: 'visitor_limit',
          retry_after_s: 60,
        },
      },
    ],
    [
      'DemoSeedSpec',
      seed.DemoSeedSpecSchema,
      {
        version: 1,
        workspace: { id: 'demo', name: 'Demo' },
        decisions: [
          {
            id: 'd1',
            law_firm_id: 'partners-group',
            sample_id: '03',
            issue_class: 'broken_cross_reference',
            quote: 'q',
            decision: 'dismissed',
            reason_code: 'other',
            fund_name: 'F',
            decided_by_name: 'A',
            decided_at: 1,
          },
        ],
      },
    ],
  ];
  it.each(cases)('%s parses and re-serializes identically', (_name, schema, value) => {
    const parsed = schema.parse(value);
    expect(schema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
  });

  it('refinements: dismissed needs reason_code, w needs a, AI severity <= high, oversize lookup rejected', () => {
    expect(
      memory.CreateDecisionRequestSchema.safeParse({
        client_op_id: 'op_12345678',
        finding_ref: 'f',
        decision: 'dismissed',
        quote_text: 'q',
        fingerprint: FP,
        issue_class: 'ambiguity',
      }).success,
    ).toBe(false);
    expect(
      claims.SessionClaimsSchema.safeParse({ v: 'v', w: 'ws', iat: 1, exp: 2, kid: 'k' }).success,
    ).toBe(false);
    expect(
      ai.AiFindingSchema.safeParse({
        candidate_id: 'c',
        issue_class: 'ambiguity',
        severity: 'critical',
        confidence: 1,
        quote: 'q',
        explanation: 'e',
      }).success,
    ).toBe(false);
    expect(
      memory.MemoryLookupRequestSchema.safeParse({
        law_firm_id: 'x',
        fingerprints: Array(201).fill(FP),
      }).success,
    ).toBe(false);
  });

  it('MemoryLabel enum equals the DATA-MODEL memory_label CHECK list', () => {
    expect([...memory.MEMORY_LABELS]).toEqual([
      'new',
      'previously_dismissed',
      'dismissed_reconfirm',
      'already_answered',
      'awaiting_counsel',
    ]);
  });
});

describe('errorStatus (exhaustive)', () => {
  it('maps every code to its HTTP status', () => {
    const expected: Record<errors.ErrorCode, number> = {
      fingerprint_mismatch: 422,
      conflict_active_decision: 409,
      read_only_demo: 403,
      invalid_session: 401,
      rate_limited: 429,
      quota_exhausted: 429,
      budget_cap: 503,
      upstream_failed: 502,
      memory_unavailable: 503,
      payload_too_large: 413,
      unsupported_type: 415,
      invalid_request: 400,
    };
    for (const code of errors.ERROR_CODES) expect(errors.errorStatus(code)).toBe(expected[code]);
    expect(Object.keys(expected).sort()).toEqual([...errors.ERROR_CODES].sort());
  });
  it('the HTTP body and the error frame share one schema (reason? on both)', () => {
    const detail = {
      code: 'quota_exhausted',
      message: 'limit',
      reason: 'visitor_limit',
      retry_after_s: 30,
    } as const;
    expect(errors.ErrorBodySchema.parse({ error: detail }).error).toEqual(detail);
    expect(frames.parseFrameLine(JSON.stringify({ t: 'error', ...detail }))).toEqual({
      t: 'error',
      ...detail,
    });
  });
});

describe('frames-parse', () => {
  const result = {
    t: 'result',
    kind: 'ai',
    data: { v: 1, findings: [] },
    cache: 'miss',
    model: 'm:free',
  };
  it('parses hb, result and error frames', () => {
    expect(frames.parseFrameLine('{"t":"hb"}')).toEqual({ t: 'hb' });
    expect(frames.parseFrameLine(JSON.stringify(result))).toMatchObject({
      t: 'result',
      kind: 'ai',
    });
    expect(
      frames.parseFrameLine('{"t":"error","code":"budget_cap","message":"cap"}'),
    ).toMatchObject({ code: 'budget_cap' });
  });
  it('rejects unknown t, malformed JSON and invalid shapes', () => {
    expect(() => frames.parseFrameLine('{"t":"progress"}')).toThrow(frames.FrameParseError);
    expect(() => frames.parseFrameLine('{nope')).toThrow(frames.FrameParseError);
    expect(() => frames.parseFrameLine('{"t":"error","code":"nope","message":"x"}')).toThrow(
      frames.FrameParseError,
    );
    expect(() => frames.parseFrameLine('{"t":"hb","x":1}')).toThrow(frames.FrameParseError);
  });
  it('a stream has exactly one terminal frame, last', () => {
    const hb = '{"t":"hb"}';
    expect(
      frames.parseFrameStream([hb, hb, JSON.stringify(result)].join('\n') + '\n'),
    ).toMatchObject({ heartbeats: 2 });
    expect(() =>
      frames.parseFrameStream([JSON.stringify(result), JSON.stringify(result)].join('\n')),
    ).toThrow(/after terminal/);
    expect(() => frames.parseFrameStream([JSON.stringify(result), hb].join('\n'))).toThrow(
      /after terminal/,
    );
    expect(() => frames.parseFrameStream(hb)).toThrow(/no terminal/);
    expect(frames.frameLine({ t: 'hb' })).toBe('{"t":"hb"}\n');
  });
  it('additive-only: unknown fields inside ext are kept, an unknown top-level optional field is ignored', () => {
    const r = ai.AiResultSchema.parse({
      v: 1,
      findings: [],
      ext: { future_field: 1 },
      new_optional: true,
    });
    expect(r.ext).toEqual({ future_field: 1 });
    expect(
      ai.AiRequestSchema.safeParse({
        v: 2,
        law_firm_id: null,
        candidates: [{ id: 'c', quote: 'q', section_path: [] }],
        settings: {},
      }).success,
    ).toBe(false);
  });
});

describe('cache-key contract', () => {
  it('matches the documented derivation', () => {
    const input = {
      kind: 'ai',
      input_hash: 'a'.repeat(64),
      model: 'm:free',
      prompt_ver: 'p1',
      schema_ver: 's1',
      rules_hash: 'none',
    } as const;
    expect(cacheKeyMod.cacheKey(input)).toMatch(/^[0-9a-f]{64}$/);
    expect(() => cacheKeyMod.cacheKey({ ...input, model: 'a|b' })).toThrow();
  });
});

describe('ports conformance (type-level)', () => {
  it('fakes satisfy the port interfaces', async () => {
    const platform: PlatformPort = {
      now: () => 1,
      randomId: () => 'id',
      sha256Hex: async (s) => s,
    };
    const quotaPort: QuotaPort = {
      claim: async () => ({ ok: true, refundToken: 't' }),
      refund: async () => undefined,
      usage: async () => ({
        ai: { used: 0, limit: 3, resets_at: 0 },
        ocr_pages: { used: 0, limit: 6, resets_at: 0 },
        global_ok: true,
      }),
    };
    const cache: CachePort = { get: async () => null, put: async () => undefined };
    const ledger: LedgerPort = { record: async () => undefined };
    const rules: RulesPort = { activeRules: async () => ({ texts: [], rules_hash: 'none' }) };
    const turnstile: TurnstilePort = { verify: async () => ({ ok: false }) };
    expectTypeOf(platform.now).returns.toEqualTypeOf<number>();
    expectTypeOf(quotaPort.claim).returns.resolves.toEqualTypeOf<QuotaClaimResult>();
    expectTypeOf<Awaited<ReturnType<CachePort['get']>>>().toMatchTypeOf<unknown>();
    expect(await quotaPort.claim({ scope: 'visitor_ai', key: 'v' }, 1)).toEqual({
      ok: true,
      refundToken: 't',
    });
    expect(await cache.get('k')).toBeNull();
    await ledger.record({ kind: 'llm', model: 'm', units: 1, cache: 'miss', at: 1 });
    expect(await rules.activeRules('firm-x')).toEqual({ texts: [], rules_hash: 'none' });
    expect(await turnstile.verify('t', 'ip')).toEqual({ ok: false });
  });
});
