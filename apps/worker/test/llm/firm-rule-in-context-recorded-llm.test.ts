// AC51 (Hybrid, recorded): the workspace's active firm rule reaches the model as context inside the
// delimited untrusted rules block (exactly the recorded prompt), and the finding on the clause the
// rule talks about is still returned: rules are context, never a filter. Live model use of the
// rule stays the named residual (no live call here).
import { UNTRUSTED_RULES_TAG, inputHash } from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { frames, makeHarness, send } from '../fakes/harness';
import {
  aiReq,
  recordingByCase,
  replay,
  rulesIn,
  userContent,
  workspaceCookie,
} from './llm-helpers';

describe('firm-rule-in-context-recorded-llm (AC51)', () => {
  test('the active rule is in the forwarded context and the finding is not filtered', async () => {
    const r = recordingByCase('firm-rules-in-context-03');
    expect(r.request.rule_texts.length).toBe(1);
    const h = makeHarness();
    h.platform.setRules('ws_ctx', 'firm-x', r.request.rule_texts);
    h.or.reply(replay(r));
    const { terminal } = await frames(
      await send(h, {
        cookie: await workspaceCookie('ws_ctx'),
        body: aiReq(r.request.candidates, 'firm-x'),
      }),
    );
    const call = h.or.calls[0]!;
    expect(rulesIn(call)).toEqual(r.request.rule_texts);
    const user = userContent(call);
    expect(user.indexOf(`<${UNTRUSTED_RULES_TAG}>`)).toBeGreaterThan(0);
    expect(inputHash(call.json['messages'] as never)).toBe(r.rec.inputHash);
    expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
    const findings = (terminal as { data: { findings: { candidate_id: string }[] } }).data.findings;
    expect(findings).toHaveLength(1);
    expect(findings[0]!.candidate_id).toBe(r.request.candidates[0]!.id);
  });

  test('the same candidate without the firm rule is a different prompt (rule changes the context)', async () => {
    const r = recordingByCase('firm-rules-in-context-03');
    const h = makeHarness();
    h.or.reply(replay(r));
    await frames(await send(h, { body: aiReq(r.request.candidates, null) }));
    expect(rulesIn(h.or.calls[0]!)).toEqual([]);
    expect(inputHash(h.or.calls[0]!.json['messages'] as never)).not.toBe(r.rec.inputHash);
  });
});
