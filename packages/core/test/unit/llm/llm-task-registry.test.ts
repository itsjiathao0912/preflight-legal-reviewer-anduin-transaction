import { describe, expect, it } from 'vitest';
import { AI_TASK_IDS, AiRequestSchema, AiResultSchema } from '../../../src/contracts/ai';
import { TASKS, DEFAULT_TASK_ID, taskById } from '../../../src/llm/registry';
import { selectInjectedRules } from '../../../src/llm/rules';
import { inputHash, inputHash16, responseFormat, schemaInstruction } from '../../../src/llm/wire';
import { LlmRecordingSchema, recordingPath } from '../../../src/llm/transport';
import { buildAiCandidates } from '../../../src/llm/candidates';
import { provenanceOf, provenanceText } from '../../../src/llm/provenance';
import { limits } from '../../../src/config/limits';
import { analyzed } from '../../helpers/samples';

const input = {
  candidates: [
    { id: 'c1', quote: 'q one', section_path: ['1'] },
    { id: 'c2', quote: 'q two', section_path: [] },
  ],
};

describe('llm task registry and wire (Phase 05 Stage 0)', () => {
  it('registers every contract task id; prompt versions are frozen', () => {
    expect(Object.keys(TASKS).sort()).toEqual([...AI_TASK_IDS].sort());
    expect(DEFAULT_TASK_ID).toBe('clause-judgment');
    expect(TASKS['clause-judgment'].promptVersion).toBe('clause-judgment@1');
    expect(TASKS['counsel-draft'].promptVersion).toBe('counsel-draft@1');
    expect(TASKS['clause-judgment'].schemaVersion).toBe('clause-judgment.s1');
    expect(TASKS['counsel-draft'].schemaVersion).toBe('counsel-draft.s1');
    expect(taskById('nope')).toBeUndefined();
    expect(taskById('counsel-draft')).toBe(TASKS['counsel-draft']);
  });

  it('frozen prompt text: inputHash of a fixed input is pinned (bump promptVersion on change)', () => {
    const h = inputHash(
      TASKS['clause-judgment'].buildMessages(input, selectInjectedRules(['Rule A.'])),
    );
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(inputHash16(h)).toHaveLength(16);
    expect(h).toMatchInlineSnapshot(
      `"487cdcb3491a84dbaa8f5556a35e3107584c39ee721652744d6e730781782e47"`,
    );
  });

  it('AiRequestSchema defaults task to clause-judgment and rejects unknown tasks', () => {
    const base = { v: 1, law_firm_id: null, candidates: input.candidates, settings: {} };
    expect(AiRequestSchema.parse(base).task).toBe('clause-judgment');
    expect(AiRequestSchema.parse({ ...base, task: 'counsel-draft' }).task).toBe('counsel-draft');
    expect(AiRequestSchema.safeParse({ ...base, task: 'free-form' }).success).toBe(false);
  });

  it('clause-judgment validate: wraps envelope, drops invalid / unknown-candidate items individually', () => {
    const t = TASKS['clause-judgment'];
    const good = {
      candidate_id: 'c1',
      issue_class: 'ambiguity',
      severity: 'low',
      confidence: 0.4,
      quote: 'q one',
      explanation: 'e',
      interpretations: [],
    };
    const r = t.validate(
      {
        findings: [
          good,
          { ...good, severity: 'critical' },
          { ...good, candidate_id: 'ghost' },
          'junk',
        ],
        extra: 1,
      },
      input,
      { tokens_in: 10, tokens_out: 5 },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.dropped).toBe(3);
    expect(r.result).toEqual({
      v: 1,
      findings: [good],
      usage: { tokens_in: 10, tokens_out: 5 },
      ext: { dropped: 3 },
    });
    expect(AiResultSchema.safeParse(r.result).success).toBe(true);
    expect(t.validate({ findings: [] }, input)).toEqual({
      ok: true,
      result: { v: 1, findings: [] },
      dropped: 0,
    });
    expect(t.validate('prose', input)).toEqual({ ok: false, reason: 'malformed' });
    expect(t.validate({ result: [] }, input)).toEqual({ ok: false, reason: 'malformed' });
  });

  it('counsel-draft validate: drafts <= 1500 chars, known candidates only', () => {
    const t = TASKS['counsel-draft'];
    const r = t.validate(
      {
        drafts: [
          { candidate_id: 'c2', text: 'Please confirm.' },
          { candidate_id: 'c1', text: 'x'.repeat(1501) },
        ],
      },
      input,
    );
    if (!r.ok) throw new Error('malformed');
    expect(r.result.drafts).toEqual([{ candidate_id: 'c2', text: 'Please confirm.' }]);
    expect(r.result.findings).toEqual([]);
    expect(r.dropped).toBe(1);
  });

  it('model-facing schema is strict: every key required, no v / usage / ext', () => {
    for (const t of Object.values(TASKS)) {
      const rf = responseFormat(t) as {
        type: string;
        json_schema: { strict: boolean; schema: Record<string, unknown> };
      };
      expect(rf.type).toBe('json_schema');
      expect(rf.json_schema.strict).toBe(true);
      const walk = (s: unknown): void => {
        if (!s || typeof s !== 'object') return;
        const o = s as Record<string, unknown>;
        if (o['type'] === 'object') {
          expect(o['additionalProperties']).toBe(false);
          expect([...(o['required'] as string[])].sort()).toEqual(
            Object.keys(o['properties'] as object).sort(),
          );
          for (const k of ['v', 'usage', 'ext'])
            expect(Object.keys(o['properties'] as object)).not.toContain(k);
        }
        Object.values(o).forEach(walk);
      };
      walk(rf.json_schema.schema);
      expect(responseFormat(t, 'json_object')).toEqual({ type: 'json_object' });
      expect(schemaInstruction(t).content).toContain(JSON.stringify(t.modelResultSchema.schema));
    }
  });

  it('recording schema and path', () => {
    const h = 'a'.repeat(64);
    expect(recordingPath('clause-judgment', h)).toBe('clause-judgment/aaaaaaaaaaaaaaaa.json');
    expect(
      LlmRecordingSchema.safeParse({
        taskId: 'clause-judgment',
        promptVersion: 'clause-judgment@1',
        inputHash: h,
        model: 'm:free',
        messagesDigest: h,
        response: { raw: '{}', parsed: {} },
        meta: { source: 'authored', served_model: 'm:free', recordedAt: '2026-10-17' },
      }).success,
    ).toBe(true);
  });

  it('candidates: deterministic, capped, schema-valid, document order', () => {
    const { g, findings } = analyzed(1);
    const a = buildAiCandidates(g, findings);
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThanOrEqual(limits.aiCandidates);
    expect(buildAiCandidates(g, findings)).toEqual(a);
    expect(new Set(a.map((c) => c.id)).size).toBe(a.length);
    const req = AiRequestSchema.safeParse({ v: 1, law_firm_id: null, candidates: a, settings: {} });
    expect(req.success).toBe(true);
    expect(buildAiCandidates(g, findings, 3)).toHaveLength(Math.min(3, a.length));
    expect(buildAiCandidates(g, findings, 0)).toEqual([]);
    // the deterministic findings' sentences are always selected first
    for (const f of findings.slice(0, 3)) expect(a.some((c) => c.quote === f.quote)).toBe(true);
  });

  it('provenance chips', () => {
    expect(
      provenanceText(provenanceOf({ detector_kind: 'rule', detector_id: 'ref-this-section' })),
    ).toBe('Rule ref-this-section');
    expect(
      provenanceText(
        provenanceOf({
          detector_kind: 'ai',
          detector_id: 'ai:clause-judgment',
          model: 'm',
          provenance: 'cache',
        }),
      ),
    ).toBe('AI suggestion · from cache');
  });
});
