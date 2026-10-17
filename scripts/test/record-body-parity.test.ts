import { describe, expect, it } from 'vitest';
import { AI_MAX_TOKENS, TASKS, inputHash, responseFormat } from '@aduin/core';
import {
  AI_MAX_TOKENS as SCRIPT_MAX_TOKENS,
  TEXT_MODEL,
  forwardedMessages,
  upstreamBody,
} from '../src/record/ai-request';
import { CASES, caseRequest } from '../src/record/casebook';

/**
 * record-body-parity (AC28, scripts side): the body record-ai sends is built only from core
 * (`TASKS[task].buildMessages`, `responseFormat`, `inputHash`) in the Worker `buildBody` template,
 * so the recorded request is the request the Worker forwards. The Worker side asserts the same
 * template in apps/worker/test (`record-body-parity`, Stage 1a).
 */
describe('record-body-parity (scripts)', () => {
  it('max_tokens comes from the single core constant (review L1)', () => {
    expect(SCRIPT_MAX_TOKENS).toBe(AI_MAX_TOKENS);
    expect(AI_MAX_TOKENS).toBe(10_000);
  });

  it.each(CASES.map((c) => [c.id, c] as const))(
    '%s: body = Worker template over core messages',
    (_id, c) => {
      for (const mode of ['json_schema', 'json_object'] as const) {
        const r = caseRequest(c, mode);
        const body = upstreamBody(r);
        const j = JSON.parse(body) as Record<string, unknown>;
        expect(Object.keys(j)).toEqual([
          'model',
          'models',
          'messages',
          'temperature',
          'max_tokens',
          'response_format',
        ]);
        expect(j['model']).toBe(TEXT_MODEL);
        expect(j['models']).toEqual([TEXT_MODEL]);
        expect(j['temperature']).toBe(0);
        expect(j['max_tokens']).toBe(AI_MAX_TOKENS);
        expect(j['response_format']).toEqual(responseFormat(TASKS[c.task], mode));
        const msgs = TASKS[c.task].buildMessages(
          { candidates: r.candidates },
          { texts: [], applied: 0, total: 0, truncated: false, hash: 'none', hash8: 'none' },
        );
        if (c.rule_texts.length === 0 && mode === 'json_schema')
          expect(j['messages']).toEqual(msgs);
        // byte parity of the messages segment: the inputHash input is exactly what is forwarded
        const seg = JSON.stringify(forwardedMessages(r));
        expect(body).toContain(`"messages":${seg},`);
        expect(inputHash(j['messages'] as never)).toBe(inputHash(forwardedMessages(r)));
      }
    },
  );

  it('a fixedCandidates case sends exactly its fixed candidates (counsel-draft-03)', () => {
    const c = CASES.find((x) => x.id === 'counsel-draft-03')!;
    expect(c.fixedCandidates?.length).toBe(2);
    expect(caseRequest(c).candidates).toEqual(c.fixedCandidates);
  });

  it('json_object mode appends the schema instruction as the last system message', () => {
    const r = caseRequest(CASES[0]!, 'json_object');
    const m = forwardedMessages(r);
    expect(m.at(-1)!.role).toBe('system');
    expect(m.at(-1)!.content).toContain('JSON schema');
  });
});
