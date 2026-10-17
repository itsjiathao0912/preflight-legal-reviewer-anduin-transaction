import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TASKS } from '../../src/llm/registry';
import { RecordingMissError } from '../../src/llm/transport';
import { locateQuote, verifyAiResult } from '../../src/llm/verify-quote';
import {
  RecordedTransport,
  recordingByCase,
  transportRequest,
} from '../helpers/recorded-transport';
import { analyzed, blockText } from '../helpers/samples';

/** AC28 over committed recordings: every AI quote must literally exist in the document. */
describe('llm-quote-must-exist (recorded, AC28)', () => {
  const fetchSpy = vi.fn(() => {
    throw new Error('network is not allowed in recorded tests');
  });
  beforeEach(() => vi.stubGlobal('fetch', fetchSpy));
  afterEach(() => vi.unstubAllGlobals());

  async function replay(caseId: string) {
    const file = recordingByCase(caseId);
    const t = new RecordedTransport();
    const res = await t.send(transportRequest(file.request, file.recording.model));
    const task = TASKS[file.request.task];
    const v = task.validate(res.parsed, { candidates: file.request.candidates });
    if (!v.ok) throw new Error(`${caseId}: malformed`);
    const { g } = analyzed(Number(file.request.sample));
    return {
      v,
      out: verifyAiResult(g, v.result, {
        model: res.servedModel,
        provenance: 'cache',
        task: task.id,
      }),
      g,
    };
  }

  it.each(['sample-01', 'sample-03'])(
    'locates every quote of %s and snaps it to the document sentence',
    async (id) => {
      const { v, out, g } = await replay(id);
      if (!out.ok) throw new Error('schema');
      expect(v.result.findings.length).toBeGreaterThan(0);
      expect(out.findings.length).toBeGreaterThan(0);
      // live recordings may hold unlocatable quotes: each must be rejected, never kept
      for (const r of out.rejected) {
        expect(r.reason).toBe('quote_not_found');
        const q = v.result.findings.find((x) => x.candidate_id === r.candidate_id)!.quote;
        expect(locateQuote(g, q)).toBeNull();
      }
      const kept = new Set(out.findings.map((f) => f.detail.facts.candidate_id));
      for (const x of v.result.findings)
        if (!out.rejected.some((r) => r.candidate_id === x.candidate_id))
          expect(locateQuote(g, x.quote), x.candidate_id).not.toBeNull();
      expect(kept.size).toBeGreaterThan(0);
      for (const f of out.findings) {
        expect(f.detector_kind).toBe('ai');
        expect(['high', 'medium', 'low']).toContain(f.severity);
        const bi = g.structure.blocks.findIndex((b) => b.id === f.anchor.blockId);
        expect(blockText(g, bi)).toContain(f.quote);
      }
      expect(fetchSpy).not.toHaveBeenCalled();
    },
  );

  it('should reject an AI finding whose quote is not in the document (hallucinated recording)', async () => {
    const { v, out } = await replay('hostile-hallucinated-quote');
    expect(v.result.findings).toHaveLength(1);
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toEqual([]);
    expect(out.rejected).toEqual([
      { candidate_id: 'c_a603f23420e703bd', reason: 'quote_not_found' },
    ]);
  });

  it('keeps the firm-rules-in-context finding only because its quote exists', async () => {
    const { v, out, g } = await replay('firm-rules-in-context-03');
    if (!out.ok) throw new Error('schema');
    expect(out.findings).toHaveLength(1);
    // the snapped document sentence holds the model's quote (re-pointed off the rule-flagged
    // placeholder sentence, which is no longer an AI candidate)
    expect(out.findings[0]!.quote).toContain(v.result.findings[0]!.quote);
    const bi = g.structure.blocks.findIndex((b) => b.id === out.findings[0]!.anchor.blockId);
    expect(blockText(g, bi)).toContain(out.findings[0]!.quote);
  });

  it('throws RecordingMissError on a miss and never touches the network', async () => {
    const file = recordingByCase('sample-01');
    const req = transportRequest(
      { ...file.request, rule_texts: ['a rule that changes the prompt'] },
      'm',
    );
    await expect(new RecordedTransport().send(req)).rejects.toBeInstanceOf(RecordingMissError);
    const wrongVersion = {
      ...transportRequest(file.request, 'm'),
      promptVersion: 'clause-judgment@0',
    };
    await expect(new RecordedTransport().send(wrongVersion)).rejects.toBeInstanceOf(
      RecordingMissError,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
