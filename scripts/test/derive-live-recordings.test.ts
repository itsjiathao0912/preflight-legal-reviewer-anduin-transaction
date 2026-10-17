import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LlmRecordingSchema } from '@aduin/core';
import { RECORDINGS_DIR, requestHash, type RecordedRequest } from '../src/record/ai-request';
import { authorAll, fileFor, isKept, serialize } from '../src/record/author-recordings';
import { caseById, caseRequest, type RecordingCase } from '../src/record/casebook';
import { deriveAll, deriveRecording, isEngineCase } from '../src/record/derive-live-recordings';

/**
 * derive-live-recordings (AC13, ai-review-stream-dedup C4/C5): derived recordings keep only the
 * model's real findings on text it saw, are labeled authored + derived_from, are deterministic and
 * idempotent; record:author keeps live and derived files without evaluating their authored arm.
 */
let tmp: string | undefined;
afterEach(() => {
  if (tmp) rmSync(tmp, { recursive: true, force: true });
  tmp = undefined;
});

const cand = (id: string, quote: string, hint?: string) => ({
  id,
  quote,
  section_path: ['S'],
  ...(hint ? { issue_class_hint: hint } : {}),
});
const finding = (candidate_id: string, quote: string) => ({
  candidate_id,
  issue_class: 'ambiguity',
  severity: 'low',
  confidence: 0.5,
  quote,
  explanation: 'x',
  interpretations: [],
});
const HASH = 'a'.repeat(64);

interface Derived {
  inputHash: string;
  meta: unknown;
  request: { derived_from: { dropped: number } & Record<string, unknown> };
  response: { parsed: { findings: { candidate_id: string }[] } };
}

function legacy(findings: unknown[], candidates: unknown[]) {
  return {
    case: 'sample-x',
    taskId: 'clause-judgment',
    promptVersion: 'clause-judgment@1',
    inputHash: 'b'.repeat(64),
    model: 'nvidia/nemotron-3-super-120b-a12b:free',
    messagesDigest: 'b'.repeat(64),
    request: {
      task: 'clause-judgment',
      sample: '01',
      candidates,
      rule_texts: [],
      mode: 'json_schema',
    },
    response: { raw: JSON.stringify({ findings }), parsed: { findings } },
    meta: {
      source: 'live',
      served_model: 'nvidia/nemotron-3-super-120b-a12b:free',
      recordedAt: '2026-10-17T00:19:00.650Z',
      tokens: { in: 1, out: 2 },
    },
  };
}

const req = (candidates: ReturnType<typeof cand>[]): RecordedRequest => ({
  task: 'clause-judgment',
  sample: '01',
  candidates: candidates as RecordedRequest['candidates'],
  rule_texts: [],
  mode: 'json_schema',
});

describe('derive-live-recordings (AC13)', () => {
  const OLD = [
    cand('c1', 'one sentence', 'ambiguity'),
    cand('c2', 'two', 'defined_term_issue'),
    cand('c3', 'three'),
  ];
  const F = [finding('c1', 'one sentence'), finding('c2', 'two'), finding('c3', 'three')];

  it('should keep derived recordings labeled authored with derived_from and make no live call', () => {
    const out = deriveRecording(
      legacy(F, OLD),
      req([OLD[0]!, OLD[2]!]),
      HASH,
    ) as unknown as Derived;
    expect(LlmRecordingSchema.safeParse(out).success).toBe(true);
    expect(out['meta']).toEqual({
      source: 'authored',
      served_model: 'nvidia/nemotron-3-super-120b-a12b:free',
      recordedAt: '2026-10-17T00:19:00.650Z',
    });
    expect(out['request'].derived_from).toEqual({
      inputHash16: 'b'.repeat(16),
      source: 'live',
      kept: 2,
      dropped: 1,
    });
    expect(
      out['response'].parsed.findings.map((f: { candidate_id: string }) => f.candidate_id),
    ).toEqual(['c1', 'c3']);
    expect(out['inputHash']).toBe(HASH);
  });

  it('drops a finding whose candidate hint changed (the model saw different context)', () => {
    const out = deriveRecording(
      legacy(F, OLD),
      req([cand('c1', 'one sentence', 'broken_conditional')]),
      HASH,
    ) as unknown as Derived;
    expect(out['response'].parsed.findings).toEqual([]);
    expect(out['request'].derived_from.dropped).toBe(3);
  });

  it('drops a finding whose candidate quote changed', () => {
    const out = deriveRecording(
      legacy(F, OLD),
      req([cand('c1', 'one sentence!', 'ambiguity')]),
      HASH,
    ) as unknown as Derived;
    expect(out['response'].parsed.findings).toEqual([]);
  });

  it('never edits finding text and is deterministic', () => {
    const a = serialize(deriveRecording(legacy(F, OLD), req(OLD), HASH));
    const b = serialize(deriveRecording(legacy(F, OLD), req(OLD), HASH));
    expect(a).toBe(b);
    expect(JSON.parse(a).response.parsed.findings).toEqual(F);
  });

  it('refuses a non-live input', () => {
    const l = legacy(F, OLD);
    l.meta.source = 'authored';
    expect(() => deriveRecording(l, req(OLD), HASH)).toThrow(/not a live/);
  });

  it('deriveAll on a real archived case is idempotent (second run unchanged)', () => {
    tmp = mkdtempSync(join(tmpdir(), 'derive-'));
    const c = caseById('sample-01');
    expect(isEngineCase(c)).toBe(true);
    expect(isEngineCase(caseById('counsel-draft-03'))).toBe(false);
    const r = caseRequest(c);
    const from = join(tmp, 'archive');
    mkdirSync(from);
    const leg = legacy(
      [finding(r.candidates[0]!.id, r.candidates[0]!.quote)],
      [...r.candidates, cand('c_gone', 'x')],
    );
    leg.case = 'sample-01';
    writeFileSync(join(from, 'legacy.json'), JSON.stringify(leg));
    const dir = join(tmp, 'rec');
    const one = deriveAll({ from, dir, cases: [c] });
    expect(one.written).toHaveLength(1);
    const two = deriveAll({ from, dir, cases: [c] });
    expect(two.written).toHaveLength(0);
    expect(two.unchanged).toHaveLength(1);
    const path = fileFor(c, requestHash(r)).replace(RECORDINGS_DIR, dir);
    expect(isKept(JSON.parse(readFileSync(path, 'utf8')))).toBe('derived');
  });
});

describe('record:author keep rule (C4)', () => {
  function write(path: string, body: unknown) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(body));
  }

  it('keeps live and derived files without evaluating their authored arm', () => {
    tmp = mkdtempSync(join(tmpdir(), 'author-'));
    const base = caseById('hostile-prose-around-json');
    // no authored arm exists for these ids: evaluating authoredRaw would throw
    const live: RecordingCase = { ...base, id: 'no-arm-live' };
    const derived: RecordingCase = { ...base, id: 'no-arm-derived', pick: ['c_777504f5f99ae768'] };
    const pl = fileFor(live, requestHash(caseRequest(live))).replace(RECORDINGS_DIR, tmp);
    const pd = fileFor(derived, requestHash(caseRequest(derived))).replace(RECORDINGS_DIR, tmp);
    write(pl, { meta: { source: 'live' } });
    write(pd, { request: { derived_from: { source: 'live' } }, meta: { source: 'authored' } });
    const rep = authorAll({ check: true }, [live, derived], tmp);
    expect(rep.keptLive).toEqual([pl]);
    expect(rep.keptDerived).toEqual([pd]);
    expect(rep.problems).toEqual([]);
  });

  it('a live case without a file gets no authored fallback: write skips, check reports missing', () => {
    tmp = mkdtempSync(join(tmpdir(), 'author-'));
    const c = caseById('sample-01');
    const w = authorAll({ check: false }, [c], tmp);
    expect(w.written).toEqual([]);
    const path = fileFor(c, requestHash(caseRequest(c))).replace(RECORDINGS_DIR, tmp);
    expect(existsSync(path)).toBe(false);
    const k = authorAll({ check: true }, [c], tmp);
    expect(k.problems).toEqual([`sample-01: missing (run record:derive) ${path}`]);
  });

  it('an old-hash file with no case is an orphan in --check', () => {
    tmp = mkdtempSync(join(tmpdir(), 'author-'));
    write(join(tmp, 'clause-judgment', '0000000000000000.json'), { meta: { source: 'live' } });
    const rep = authorAll({ check: true }, [], tmp);
    expect(rep.problems).toEqual([
      `orphan recording ${join(tmp, 'clause-judgment', '0000000000000000.json')}`,
    ]);
  });
});
