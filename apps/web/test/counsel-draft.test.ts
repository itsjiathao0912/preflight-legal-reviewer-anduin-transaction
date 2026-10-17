import 'fake-indexeddb/auto';
import { INTERPRETATION_MAX_CHARS, templateQuestionText, type IssueClass } from '@aduin/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiCall } from '../src/features/ai/stream-client';
import type { StreamTerminal } from '../src/api/ndjson';
import type { Row } from '../src/features/review/model';

const calls: AiCall[] = [];
const next = vi.hoisted(() => ({ value: null as unknown }));
vi.mock('../src/features/ai/stream-client', () => ({
  requestAi: async (c: AiCall) => {
    calls.push(c);
    return next.value as StreamTerminal;
  },
}));

const { fetchAiDrafts, readAiDrafts, draftCandidates } =
  await import('../src/features/counsel/ai-draft');
const { useCounsel } = await import('../src/features/counsel/counsel-store');
const { wordingFor, EMPTY_DRAFTS } = await import('../src/features/counsel/sheet-model');

const ACCOUNT = '021000021';
const ITEM = {
  id: 'f1',
  quote: `Wire to account ${ACCOUNT} at the escrow bank.`,
  section_path: ['Section 9'],
  issue_class: 'ambiguity',
};
const ok = (drafts: unknown): StreamTerminal => ({
  kind: 'result',
  resultKind: 'ai',
  data: { v: 1, findings: [], drafts },
  cache: 'hit',
  model: 'gemma-4 (free)',
});
const row = (id: string, issue_class = 'ambiguity') =>
  ({ f: { id, issue_class: issue_class as IssueClass, loc: 'Section 9' } }) as unknown as Row;

beforeEach(() => {
  calls.length = 0;
  next.value = null;
});

describe('counsel-draft', () => {
  it('should mask and clamp AI drafts (L6) and ignore unknown candidate ids', () => {
    const long = `Should account ${ACCOUNT} stay? ` + 'x'.repeat(2000);
    const out = readAiDrafts(
      {
        drafts: [
          { candidate_id: 'f1', text: long },
          { candidate_id: 'zz', text: 'not asked' },
          { candidate_id: 'f2', text: '   ' },
          { candidate_id: 'f3', text: 42 },
        ],
      },
      new Set(['f1', 'f2', 'f3']),
    );
    expect(Object.keys(out)).toEqual(['f1']);
    expect(out['f1']).not.toContain(ACCOUNT);
    expect(out['f1']).toContain('#0021');
    expect(out['f1']!.length).toBeLessThanOrEqual(INTERPRETATION_MAX_CHARS);
    expect(readAiDrafts(null, new Set(['f1']))).toEqual({});
    expect(readAiDrafts({ drafts: 'nope' }, new Set(['f1']))).toEqual({});
  });

  it('should send the counsel-draft task with masked quotes and no firm', async () => {
    next.value = ok([{ candidate_id: 'f1', text: `Keep ${ACCOUNT}?` }]);
    const res = await fetchAiDrafts([ITEM], 'c'.repeat(64), true);
    expect(res).toEqual({ ok: true, drafts: { f1: 'Keep #0021?' }, model: 'gemma-4 (free)' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ task: 'counsel-draft', lawFirmId: null });
    expect(JSON.stringify(calls[0]!.candidates)).not.toContain(ACCOUNT);
    expect(draftCandidates([ITEM])[0]).toMatchObject({ id: 'f1', issue_class_hint: 'ambiguity' });
  });

  it('should fall back to the template draft when AI is off or unavailable', async () => {
    expect(await fetchAiDrafts([ITEM], 'c'.repeat(64), false)).toEqual({
      ok: false,
      reason: 'off',
    });
    expect(calls).toHaveLength(0);
    next.value = { kind: 'error', error: { code: 'upstream_failed', message: 'x' } };
    expect(await fetchAiDrafts([ITEM], 'c'.repeat(64), true)).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    next.value = ok([]);
    expect((await fetchAiDrafts([ITEM], 'c'.repeat(64), true)).ok).toBe(false);
    // the wording shown stays the template when there is no AI text, even with the AI toggle on
    const w = wordingFor(row('f1'), { ...EMPTY_DRAFTS, useAi: true });
    expect(w).toEqual({ text: templateQuestionText('ambiguity', 'Section 9'), source: 'template' });
  });

  it('should prefer edited wording, then the AI draft, and mask edits on save', async () => {
    await useCounsel.getState().load('d'.repeat(64));
    useCounsel.getState().setAiDrafts({ f1: `AI asks about ${ACCOUNT}` }, 'gemma');
    expect(wordingFor(row('f1'), useCounsel.getState().drafts).source).toBe('template');
    useCounsel.getState().setUseAi(true);
    expect(wordingFor(row('f1'), useCounsel.getState().drafts)).toEqual({
      text: 'AI asks about #0021',
      source: 'ai',
    });
    useCounsel.getState().setEdit('f1', `  Edited ${ACCOUNT} ${'y'.repeat(900)}`);
    const e = wordingFor(row('f1'), useCounsel.getState().drafts);
    expect(e.source).toBe('edit');
    expect(e.text).not.toContain(ACCOUNT);
    expect(e.text.length).toBeLessThanOrEqual(INTERPRETATION_MAX_CHARS);
    useCounsel.getState().setEdit('f1', null);
    expect(wordingFor(row('f1'), useCounsel.getState().drafts).source).toBe('ai');
  });
});
