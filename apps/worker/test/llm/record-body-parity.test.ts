// AC28 (Worker side): for every recording, the body the Worker forwards upstream is byte-identical
// to the recorded request rebuilt from core (TASKS[task].buildMessages + responseFormat, the
// Worker body template and key order), and the inputHash of the forwarded messages equals the
// recording's inputHash (the single choke point). Replaying the recorded raw model reply through
// the Worker yields exactly `task.validate(parsed)` (task-aware classify, validate once).
import {
  AI_MAX_TOKENS,
  TASKS,
  inputHash,
  responseFormat,
  schemaInstruction,
  selectInjectedRules,
} from '@aduin/core';
import { describe, expect, test } from 'vitest';
import { baseEnv, frames, makeHarness, send } from '../fakes/harness';
import { DEFAULT_TEXT_MODELS } from '../../src/config';
import { MAX_TOKENS } from '../../src/upstream/models-config';
import { aiReq, loadRecordings, replay, workspaceCookie, type RecordingFile } from './llm-helpers';

function expectedMessages(r: RecordingFile) {
  const task = TASKS[r.request.task];
  const msgs = task.buildMessages(
    { candidates: r.request.candidates },
    selectInjectedRules(r.request.rule_texts),
  );
  const all = r.request.mode === 'json_object' ? [...msgs, schemaInstruction(task)] : msgs;
  return all.map((m) => ({ role: m.role, content: m.content }));
}

function expectedBody(r: RecordingFile): string {
  const m = r.rec.model;
  return (
    `{"model":${JSON.stringify(m)},"models":${JSON.stringify([m])},` +
    `"messages":${JSON.stringify(expectedMessages(r))},"temperature":0,` +
    `"max_tokens":${AI_MAX_TOKENS},` +
    `"response_format":${JSON.stringify(responseFormat(TASKS[r.request.task], r.request.mode))}}`
  );
}

/** Replay one recording through a fresh Worker harness (rules via a workspace cookie). */
async function forward(r: RecordingFile) {
  const h = makeHarness(
    r.request.mode === 'json_object' ? { env: baseEnv({ AI_RESPONSE_MODE: 'json_object' }) } : {},
  );
  const withRules = r.request.rule_texts.length > 0;
  if (withRules) h.platform.setRules('ws_rec', 'firm-x', r.request.rule_texts);
  h.or.reply(replay(r));
  const res = await send(h, {
    body: aiReq(r.request.candidates, withRules ? 'firm-x' : null, r.request.task),
    ...(withRules ? { cookie: await workspaceCookie('ws_rec') } : {}),
  });
  const { terminal } = await frames(res);
  return { h, terminal };
}

const recordings = loadRecordings();

describe('record-body-parity (AC28, Worker side)', () => {
  test('the Worker max_tokens is the single core AI_MAX_TOKENS (review L1)', () => {
    expect(MAX_TOKENS.ai).toBe(AI_MAX_TOKENS);
  });

  test('the recordings are loaded (JSON import probe) and use the Worker text model', () => {
    expect(recordings.length).toBeGreaterThanOrEqual(9);
    for (const r of recordings) expect(r.rec.model).toBe(DEFAULT_TEXT_MODELS);
  });

  for (const r of recordings) {
    test(`${r.case}: forwarded body == recorded request; inputHash == recording`, async () => {
      const { h } = await forward(r);
      expect(h.or.calls).toHaveLength(1);
      const call = h.or.calls[0]!;
      expect(call.body).toBe(expectedBody(r));
      const forwarded = call.json['messages'] as { role: 'system' | 'user'; content: string }[];
      expect(inputHash(forwarded)).toBe(r.rec.inputHash);
      expect(r.rec.messagesDigest).toBe(r.rec.inputHash);
      expect(r.rec.promptVersion).toBe(TASKS[r.request.task].promptVersion);
    });

    test(`${r.case}: replay result == task.validate(recorded parsed reply)`, async () => {
      const { terminal } = await forward(r);
      const task = TASKS[r.request.task];
      const v = task.validate(r.rec.response.parsed, { candidates: r.request.candidates });
      expect(v.ok).toBe(true);
      if (!v.ok) return;
      expect(terminal).toMatchObject({ t: 'result', kind: 'ai', cache: 'miss' });
      expect((terminal as { data: unknown }).data).toEqual(v.result);
    });
  }

  test('hostile set: prose succeeds, extra keys stripped, critical dropped, oversized dropped', async () => {
    const by = (id: string) => recordings.find((r) => r.case === id)!;
    const data = async (id: string) =>
      ((await forward(by(id))).terminal as { data: Record<string, unknown> }).data;
    const prose = await data('hostile-prose-around-json');
    expect((prose['findings'] as unknown[]).length).toBeGreaterThan(0);
    const extra = await data('hostile-extra-keys');
    expect(JSON.stringify(extra)).not.toContain('reasoning');
    expect(JSON.stringify(extra)).not.toContain('suggested_fix');
    expect(JSON.stringify(extra)).not.toContain('severity_override');
    const crit = await data('hostile-severity-critical');
    expect(crit['ext']).toEqual({ dropped: 1 });
    expect(crit['findings']).toHaveLength(1);
    const big = await data('hostile-oversized-quote');
    expect(big['findings']).toHaveLength(0);
    const halluc = await data('hostile-hallucinated-quote');
    expect((halluc['findings'] as unknown[]).length).toBe(1); // rejected later by the client verify
    const drafts = await data('counsel-draft-03');
    expect((drafts['drafts'] as unknown[]).length).toBe(2);
  });
});
