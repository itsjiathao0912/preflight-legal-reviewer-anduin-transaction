import { describe, expect, it } from 'vitest';
import { AiResultSchema } from '../../src/contracts/ai';
import { buildAiCandidates } from '../../src/llm/candidates';
import { TASKS } from '../../src/llm/registry';
import { recordingPath } from '../../src/llm/transport';
import { verifyAiResult } from '../../src/llm/verify-quote';
import { inputHash } from '../../src/llm/wire';
import { loadRecordings, messagesFor, recordingByCase } from '../helpers/recorded-transport';
import { analyzed } from '../helpers/samples';

/** AC28: model-result schema handling over the committed recordings, incl. the hostile set. */
describe('llm-schema (recorded, AC28)', () => {
  const all = loadRecordings();

  it('has the required cases on disk', () => {
    const ids = all.map((r) => r.case).sort();
    for (const id of [
      'sample-01',
      'sample-03',
      'counsel-draft-03',
      'hostile-hallucinated-quote',
      'hostile-prose-around-json',
      'hostile-extra-keys',
      'hostile-severity-critical',
      'hostile-oversized-quote',
    ])
      expect(ids).toContain(id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every recording is keyed by the inputHash of the messages built by TASKS (no drift)', () => {
    for (const r of all) {
      const h = inputHash(messagesFor(r.request));
      expect(r.recording.inputHash, r.case).toBe(h);
      expect(r.recording.messagesDigest, r.case).toBe(h);
      expect(r.path.endsWith(recordingPath(r.recording.taskId, h)), r.case).toBe(true);
      expect(r.recording.promptVersion).toBe(TASKS[r.recording.taskId].promptVersion);
      expect(r.recording.model.endsWith(':free')).toBe(true);
      expect(r.recording.meta.served_model).not.toBe('openrouter/free');
    }
  });

  it('recorded candidates are exactly what the engine selects for the sample', () => {
    for (const r of all) {
      if (r.request.sample === null) continue;
      const { g, findings } = analyzed(Number(r.request.sample));
      const byId = new Map(buildAiCandidates(g, findings).map((c) => [c.id, c]));
      for (const c of r.request.candidates) expect(byId.get(c.id), `${r.case} ${c.id}`).toEqual(c);
    }
  });

  function validate(caseId: string) {
    const r = recordingByCase(caseId);
    return { r, v: TASKS[r.request.task].validate(r.recording.response.parsed, r.request) };
  }

  it('prose around JSON: raw is not JSON, the tolerant parse yields a valid result', () => {
    const { r, v } = validate('hostile-prose-around-json');
    expect(() => JSON.parse(r.recording.response.raw)).toThrow();
    expect(v.ok && v.result.findings.length).toBe(1);
  });

  it('extra keys are stripped from the envelope and from each finding', () => {
    const { v } = validate('hostile-extra-keys');
    if (!v.ok) throw new Error('malformed');
    expect(AiResultSchema.safeParse(v.result).success).toBe(true);
    expect(Object.keys(v.result)).not.toContain('reasoning');
    expect(Object.keys(v.result.findings[0]!)).not.toContain('suggested_fix');
    expect(v.result.findings[0]!.severity).toBe('low');
  });

  it("drops a severity 'critical' finding individually and keeps the valid one", () => {
    const { v } = validate('hostile-severity-critical');
    if (!v.ok) throw new Error('malformed');
    expect(v.dropped).toBe(1);
    expect(v.result.findings.map((f) => f.severity)).toEqual(['medium']);
    expect(v.result.ext).toEqual({ dropped: 1 });
  });

  it('drops an oversized quote at validation; the verify chain rejects it as quote_too_long', () => {
    const { r, v } = validate('hostile-oversized-quote');
    if (!v.ok) throw new Error('malformed');
    expect(v.dropped).toBe(1);
    expect(v.result.findings).toEqual([]);
    const { g } = analyzed(1);
    const out = verifyAiResult(
      g,
      { v: 1, findings: (r.recording.response.parsed as { findings: unknown[] }).findings },
      {
        model: r.recording.model,
        provenance: 'cache',
      },
    );
    expect(out.ok && out.rejected).toEqual([
      { candidate_id: 'c_624f0f476f804afb', reason: 'quote_too_long' },
    ]);
  });

  it('counsel-draft recording validates into drafts for the sent candidates only', () => {
    const { r, v } = validate('counsel-draft-03');
    if (!v.ok) throw new Error('malformed');
    expect(v.result.findings).toEqual([]);
    expect(v.result.drafts?.map((d) => d.candidate_id)).toEqual(
      r.request.candidates.map((c) => c.id),
    );
  });

  it('sample recordings validate with nothing dropped', () => {
    for (const id of ['sample-01', 'sample-03']) {
      const { v } = validate(id);
      expect(v.ok && v.dropped, id).toBe(0);
    }
  });
});
