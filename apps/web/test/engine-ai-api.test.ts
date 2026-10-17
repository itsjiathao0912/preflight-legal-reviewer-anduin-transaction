import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { rulesHash, rulesHash8 as coreRulesHash8, verifyAiResult } from '@aduin/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../src/engine/engine.worker';

// spy (real implementation) so the ruleFindings wiring of the engine worker is observable (E6)
vi.mock('@aduin/core', async (orig) => {
  const m = await orig<typeof import('@aduin/core')>();
  return { ...m, verifyAiResult: vi.fn(m.verifyAiResult) };
});
import type { EngineResult } from '../src/engine/types';

// G13 engine-worker AI API: candidates, verify chain and rules hash all run in the worker module.
const ROOT = resolve(import.meta.dirname, '..', '..', '..');
const RAW = join(ROOT, 'samples', 'sub-docs', 'raw');
const PRE = join(ROOT, 'apps', 'web', 'public', 'precomputed');
const REC = join(ROOT, 'fixtures', 'llm-recordings', 'clause-judgment');

function sampleBytes(id: string): Uint8Array {
  const f = readdirSync(RAW).find((n) => n.startsWith(`${id}-`) && n.endsWith('.htm'));
  if (!f) throw new Error(`sample ${id} missing`);
  return new Uint8Array(readFileSync(join(RAW, f)));
}

interface Precomputed {
  docHash: string;
  model: string;
  rulesHash8: string;
  result: unknown;
}
function precomputed(sample: string): Precomputed {
  for (const n of readdirSync(PRE)) {
    const j = JSON.parse(readFileSync(join(PRE, n), 'utf8')) as Precomputed & { sample: string };
    if (j.sample === sample) return j;
  }
  throw new Error(`no precomputed file for ${sample}`);
}

function recordingCandidates(caseId: string): unknown {
  for (const n of readdirSync(REC)) {
    const j = JSON.parse(readFileSync(join(REC, n), 'utf8')) as {
      case: string;
      request: { candidates: unknown };
    };
    if (j.case === caseId) return j.request.candidates;
  }
  throw new Error(`no recording ${caseId}`);
}

const analyze = (id: string): Promise<EngineResult> => api.analyze(sampleBytes(id), {}, () => {});

describe('engine-ai-api', () => {
  beforeEach(async () => {
    await api.dispose();
  });

  it('should verify an AI result inside the engine worker and return findings the main thread can render without importing core values', async () => {
    const r1 = await analyze('01');
    const p1 = precomputed('01');
    expect(r1.docHash).toBe(p1.docHash);
    const v1 = await api.verifyAi(p1.result, r1.docHash, [], {
      model: p1.model,
      provenance: 'cache',
    });
    expect(v1.ok).toBe(true);
    if (!v1.ok) return;
    // 1 since ai-review-stream-dedup: rule-flagged sentences are no longer AI candidates, so the
    // derived sample-01 recording keeps only the model's finding on a surviving candidate
    // (c_624f0f476f804afb); c_a3a1fd5641d412c0 and c_bbfb16d50ab9577f were rule sentences
    expect(v1.findings).toHaveLength(1);
    expect(v1.rejected).toEqual([]);
    expect(v1.rulesHash8).toBe('none');
    expect(v1.rulesHash8).toBe(p1.rulesHash8);
    for (const f of v1.findings) {
      expect(f.detector_kind).toBe('ai');
      expect(f.provenance).toBe('cache');
      expect(f.model).toBe(p1.model);
      expect(f.severity).not.toBe('critical');
      expect(f.title.length).toBeGreaterThan(0);
      expect(f.classLabel.length).toBeGreaterThan(0);
      expect(f.locator?.paragraph).toBeGreaterThan(0);
      // the fingerprint quote is the document's own sentence: it exists in the anchored block
      const block = r1.blocks[f.order]!;
      expect(block.id).toBe(f.anchor.blockId);
      expect(block.text.slice(f.anchor.offsetStart, f.anchor.offsetEnd)).toBe(f.quote);
    }
    // structured-clone safe (Comlink): plain data only
    expect(() => structuredClone(v1)).not.toThrow();

    const r3 = await analyze('03');
    const p3 = precomputed('03');
    const v3 = await api.verifyAi(p3.result, r3.docHash, [], {
      model: p3.model,
      provenance: 'fresh',
    });
    expect(v3.ok).toBe(true);
    if (!v3.ok) return;
    // derived sample-03 keeps 3 of the 4 live findings (c_54cd421d8bdba4af was a rule sentence):
    // 1 verified, the same 2 unlocatable quotes rejected as before
    expect(v3.findings).toHaveLength(1);
    expect(v3.rejected.map((x) => x.reason)).toEqual(['quote_not_found', 'quote_not_found']);
    expect(v3.findings.every((f) => f.provenance === 'fresh')).toBe(true);
  });

  it('should pass the retained rule findings into verifyAiResult', async () => {
    const r1 = await analyze('01');
    const spy = vi.mocked(verifyAiResult);
    spy.mockClear();
    await api.verifyAi(precomputed('01').result, r1.docHash, [], {
      model: 'm',
      provenance: 'cache',
    });
    expect(spy).toHaveBeenCalledTimes(1);
    const ctx = spy.mock.calls[0]![2];
    const passed = (ctx.ruleFindings ?? []) as unknown as { id: string }[];
    expect(passed.map((f) => f.id)).toEqual(r1.findings.map((f) => f.id));
    expect(ctx.ruleFindings?.length).toBeGreaterThan(0);
  });

  it('analyze returns the graph-selected aiCandidates (same as the recorded request)', async () => {
    const r1 = await analyze('01');
    expect(r1.aiCandidates?.length).toBeGreaterThan(0);
    expect(r1.aiCandidates).toEqual(recordingCandidates('sample-01'));
    const r3 = await analyze('03');
    expect(r3.aiCandidates).toEqual(recordingCandidates('sample-03'));
  });

  it('deterministic findings carry the U1 locator (section path + paragraph)', async () => {
    const r1 = await analyze('01');
    expect(r1.findings.length).toBeGreaterThan(0);
    for (const f of r1.findings) {
      expect(f.locator).toBeDefined();
      expect(f.locator!.paragraph).toBeGreaterThan(0);
      expect(f.locator!.path).toEqual(f.section_path);
    }
  });

  it('retains at most two graphs: the least recently used is evicted (doc_not_retained)', async () => {
    const r1 = await analyze('01');
    const r3 = await analyze('03');
    const p1 = precomputed('01');
    // touch #1 so #3 becomes least recently used
    expect(
      (await api.verifyAi(p1.result, r1.docHash, [], { model: 'm', provenance: 'cache' })).ok,
    ).toBe(true);
    await analyze('05');
    const gone = await api.verifyAi(precomputed('03').result, r3.docHash, [], {
      model: 'm',
      provenance: 'cache',
    });
    expect(gone).toEqual({ ok: false, error: 'doc_not_retained' });
    const kept = await api.verifyAi(p1.result, r1.docHash, [], { model: 'm', provenance: 'cache' });
    expect(kept.ok).toBe(true);
    await api.dispose();
    const after = await api.verifyAi(p1.result, r1.docHash, [], {
      model: 'm',
      provenance: 'cache',
    });
    expect(after).toEqual({ ok: false, error: 'doc_not_retained' });
  });

  it('rejects a result that is not an AI envelope (schema) without throwing', async () => {
    const r1 = await analyze('01');
    for (const bad of [null, 'text', { v: 2, findings: [] }, { v: 1 }]) {
      const v = await api.verifyAi(bad, r1.docHash, [], { model: 'm', provenance: 'fresh' });
      expect(v).toEqual({ ok: false, error: 'schema' });
    }
  });

  it('rule-text rulesHash8 equals the core hash and is order independent', async () => {
    const texts = ['Placeholders are firm standard wording.', 'Use  "FFC"   lines as written.'];
    const expected = coreRulesHash8(rulesHash(texts));
    expect(await api.rulesHash8(texts)).toBe(expected);
    expect(await api.rulesHash8([...texts].reverse())).toBe(expected);
    expect(await api.rulesHash8([])).toBe('none');
    expect(expected).toMatch(/^[0-9a-f]{8}$/);
    const r1 = await analyze('01');
    const v = await api.verifyAi(precomputed('01').result, r1.docHash, texts, {
      model: 'm',
      provenance: 'cache',
    });
    expect(v.ok && v.rulesHash8).toBe(expected);
    expect(v.ok && [v.rulesApplied, v.rulesTotal]).toEqual([2, 2]);
  });
});
