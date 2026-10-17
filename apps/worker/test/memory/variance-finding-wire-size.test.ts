// AC-V19 / L6 (retargeted): a worst-case variance finding built from the V1 PINNED adapter caps
// passes FindingWireSchema; the byte arithmetic against FINDINGS_BODY_CAP (131,072 bytes) is
// explicit; one worst-case finding fits a request on its own (no V1 defect), a 25-finding chunk does
// not, so the web client splits by bytes (apps/web realMemoryApi test); detail is never stored.
import { env } from 'cloudflare:test';
import {
  FindingDetailSchema,
  FindingWireSchema,
  INTERPRETATION_MAX_CHARS,
  INTERPRETATIONS_MAX,
  limits,
  quoteHash,
} from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { FACT_MAX, VARIANCE_DETECTOR_PREFIX } from '../../../../packages/core/src/variance/adapter';
import { FINDINGS_BODY_CAP } from '../../src/memory/http';
import { FINDINGS_CHUNK_MAX } from '../../src/routes/memory/runs';
import { call, fpOf, makeMem, newRun, op, session } from './memory-harness';

/** Printable BMP char with the largest UTF-8 size (3 bytes) that JSON.stringify does not escape. */
const WIDE = '€';
const fill = (n: number) => WIDE.repeat(n);

// V1 caps read from the pinned sources (never retyped)
const EXPLANATION_MAX = FindingDetailSchema.shape.explanation.maxLength ?? 0;
const INTERP_MAX_ITEMS = INTERPRETATIONS_MAX;
const INTERP_MAX_CHARS = INTERPRETATION_MAX_CHARS;
const EXPECTED_MAX = FindingDetailSchema.shape.expected.unwrap().maxLength ?? 0;
const SNIPPET_MAX = limits.snippetMaxChars;

/** Every string fact a V1 change finding can carry (buildChangeFinding + impact + assertion). */
const STRING_FACTS = [
  'kind',
  'change_type',
  'rule_id',
  'variance_rules_version',
  'variance_rules_hash8',
  'baseline_doc',
  'quote_side',
  'title',
  'suggested_owners',
  'owner_reason',
  'old_text',
  'new_text',
  'unit_key_a',
  'unit_key_b',
  'impact_investor_types',
  'impact_conditionals',
  'impact_audience',
  'impact_line',
  'assertion_kind',
  'assertion_label',
];

function worstFinding(i: number) {
  const quote = `Worst case variance quote ${i}.`;
  const facts: Record<string, string | number | boolean | null> = Object.fromEntries(
    STRING_FACTS.map((k) => [k, fill(FACT_MAX)]),
  );
  facts['hunk_count'] = 999;
  facts['impact_reusable'] = false;
  facts['impact_uncertain'] = true;
  return {
    id: `vw-${i}`.padEnd(64, 'x'),
    issue_class: 'version_drift',
    severity: 'medium',
    detector_kind: 'rule',
    detector_id: `${VARIANCE_DETECTOR_PREFIX}VAR-LOGIC-ELIGIBILITY`.padEnd(80, 'X'),
    confidence: 1,
    anchor: { docHash: quoteHash('doc'), blockId: 'b-1', offsetStart: 0, offsetEnd: 10 },
    section_path: Array.from({ length: 8 }, () => fill(300)),
    quote_snippet: fill(SNIPPET_MAX),
    quote_hash: quoteHash(quote),
    fingerprint: fpOf('hartwell-crane', 'version_drift', quote),
    pattern_key: 'var-logic-eligibility'.padEnd(80, 'x'),
    detail: {
      explanation: fill(EXPLANATION_MAX),
      facts,
      interpretations: Array.from({ length: INTERP_MAX_ITEMS }, () => fill(INTERP_MAX_CHARS)),
      expected: fill(EXPECTED_MAX),
    },
  };
}

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe('variance-finding-wire-size (AC-V19)', () => {
  test('should keep every findings request body at most the body cap through the byte-aware split', () => {
    expect(FACT_MAX).toBe(1000);
    expect(EXPLANATION_MAX).toBe(1000);
    expect([INTERP_MAX_ITEMS, INTERP_MAX_CHARS]).toEqual([6, 500]);
    expect(FINDINGS_BODY_CAP).toBe(131_072);
    const worst = worstFinding(0);
    // (1) one worst-case finding passes the wire schema
    expect(FindingWireSchema.safeParse(worst).success).toBe(true);
    // explicit byte arithmetic (UTF-8 bytes, not string length)
    const envelopeBytes = bytes({ client_op_id: 'x'.repeat(64), findings: [] });
    const perFindingBytes = bytes(worst);
    const singleBodyBytes = envelopeBytes + perFindingBytes;
    const chunkBytes =
      FINDINGS_CHUNK_MAX * perFindingBytes + (FINDINGS_CHUNK_MAX - 1) + envelopeBytes;
    console.log(
      `wire-size: perFinding ${perFindingBytes} B, single body ${singleBodyBytes} B, 25-chunk ${chunkBytes} B, cap ${FINDINGS_BODY_CAP} B`,
    );
    // (4) a single worst-case finding alone fits the cap: no V1 provenance-size defect
    expect(singleBodyBytes).toBeLessThanOrEqual(FINDINGS_BODY_CAP);
    // (2)/(3) a 25-finding chunk of worst cases does NOT fit: the web client must split by bytes
    expect(chunkBytes).toBeGreaterThan(FINDINGS_BODY_CAP);
    const perRequest = Math.floor((FINDINGS_BODY_CAP - envelopeBytes) / (perFindingBytes + 1));
    expect(perRequest).toBeGreaterThanOrEqual(1);
  });

  test('a single worst-case finding is accepted by the Worker and its detail is never stored', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, 'hartwell-crane', 'Northgate Fund I');
    const worst = worstFinding(1);
    const r = await call(
      h,
      'POST',
      `/api/runs/${run}/findings`,
      { client_op_id: op(), findings: [worst] },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(200);
    expect(r.body.stored).toBe(1);
    // (5) the stored detail_json is NULL (the 2000-char CHECK never applies)
    const row = await env.DB.prepare(
      'SELECT detail_json, detector_id, pattern_key FROM finding WHERE workspace_id = ?1 AND review_run_id = ?2',
    )
      .bind(s.workspaceId, run)
      .first<{ detail_json: string | null; detector_id: string; pattern_key: string }>();
    expect(row?.detail_json).toBeNull();
    expect(row?.detector_id.startsWith(VARIANCE_DETECTOR_PREFIX)).toBe(true);
    expect(row?.pattern_key.length).toBe(80);
  });

  test('a body over the cap is refused by size before parsing (the client split is required)', async () => {
    const h = makeMem();
    const s = await session(h);
    const run = await newRun(h, s, 'hartwell-crane', 'Northgate Fund I');
    const findings = [worstFinding(2), worstFinding(3)];
    expect(bytes({ client_op_id: op(), findings })).toBeGreaterThan(FINDINGS_BODY_CAP);
    const r = await call(
      h,
      'POST',
      `/api/runs/${run}/findings`,
      { client_op_id: op(), findings },
      { cookie: s.cookie },
    );
    expect(r.status).toBe(413);
  });
});
