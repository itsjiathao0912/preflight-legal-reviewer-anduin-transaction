import { describe, expect, it } from 'vitest';
import type { DiffResult } from '../../src/diff/types';
import { TASKS } from '../../src/llm/registry';
import { selectInjectedRules } from '../../src/llm/rules';
import {
  NARRATIVE_MAX_RENAMES,
  buildDriftNarrativeCandidates,
  readDriftNarrative,
  renameOfCandidate,
} from '../../src/llm/tasks/drift-narrative.v1';
import {
  RecordedTransport,
  recordingByCase,
  transportRequest,
} from '../helpers/recorded-transport';
import { diffOk, sampleSide } from '../unit/diff/diff-helpers';

/** AC15 (H part): the drift narrative only states renames present in DiffResult.renames (07c). */
describe('drift-narrative (recorded, AC15 H)', () => {
  const r = diffOk(sampleSide(5), sampleSide(6));
  const renamePairs = new Set(r.renames.map((x) => `${x.from}\u0000${x.to}`));
  const cands = buildDriftNarrativeCandidates(r);
  const task = TASKS['drift-narrative'];

  it('builds one masked candidate per rename of #5 -> #6, nothing else', () => {
    expect(cands.length).toBe(Math.min(r.renames.length, NARRATIVE_MAX_RENAMES));
    expect(cands.length).toBe(5);
    for (const c of cands) {
      const rn = renameOfCandidate(c);
      expect(rn, c.id).toBeDefined();
      expect(renamePairs.has(`${rn!.from}\u0000${rn!.to}`), c.id).toBe(true);
      expect(c.quote.length).toBeLessThanOrEqual(1000);
    }
    // largest rename first; at least the top rename carries a before/after sample
    expect(renameOfCandidate(cands[0]!)).toEqual({ from: 'Units', to: 'Shares' });
    expect(cands[0]!.quote).toMatch(/\nBefore: .*Units/);
    expect(cands[0]!.quote).toMatch(/\nAfter: .*Shares/);
  });

  it('is empty for sibling mode and for a result without renames', () => {
    expect(buildDriftNarrativeCandidates({ ...r, mode: 'sibling' })).toEqual([]);
    expect(buildDriftNarrativeCandidates({ ...r, renames: [] })).toEqual([]);
  });

  it('should never put a raw sensitive span or a 5+ digit run into the task input (E18)', () => {
    const SEEDED = '021000021987654';
    const raw = (t: string) => {
      const at = t.indexOf(SEEDED);
      return { text: t, sensitiveSpans: [{ start: at, end: at + SEEDED.length }] };
    };
    const seeded: DiffResult = {
      ...r,
      renames: [{ from: 'Units', to: 'Shares', count: 3, occurrences: 3, confidence: 1 }],
      definitions: [],
      sections: [
        {
          status: 'changed',
          kind: 'section',
          pathA: ['Wire'],
          pathB: ['Wire'],
          truncated: false,
          a: {
            ...raw(`Pay for the Units to account ${SEEDED} at the bank.`),
            clippedStart: false,
            clippedEnd: false,
          },
          b: {
            ...raw(`Pay for the Shares to account ${SEEDED} at the bank.`),
            clippedStart: false,
            clippedEnd: false,
          },
        },
      ],
    };
    const [c] = buildDriftNarrativeCandidates(seeded);
    expect(c!.quote).toMatch(/Before: .*Units/);
    const input = JSON.stringify(task.buildMessages({ candidates: [c!] }, selectInjectedRules([])));
    for (const s of [c!.quote, input]) {
      expect(s).not.toContain(SEEDED);
      expect(s).not.toMatch(/\d{5,}/);
      expect(s).toContain('#7654');
    }
    // unspanned digits are masked by pattern too (belt and braces)
    const noSpan: DiffResult = {
      ...seeded,
      sections: seeded.sections.map((x) => ({
        ...x,
        a: { ...x.a!, sensitiveSpans: [] },
        b: { ...x.b!, sensitiveSpans: [] },
      })),
    };
    expect(buildDriftNarrativeCandidates(noSpan)[0]!.quote).not.toMatch(/\d{5,}/);
  });

  it('replays the #5 -> #6 recording: every kept line names a rename found by the diff', async () => {
    const rec = recordingByCase('drift-narrative-05-06');
    // recorded request = current builder output (no candidate drift)
    expect(rec.request.candidates).toEqual(cands);
    const t = new RecordedTransport();
    const res = await t.send(transportRequest(rec.request, rec.recording.model));
    expect(t.calls).toHaveLength(1);
    const v = task.validate(res.parsed, { candidates: cands }, res.usage);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    const drafts = v.result.drafts ?? [];
    expect(drafts.length).toBeGreaterThanOrEqual(1);
    const byId = new Map(cands.map((c) => [c.id, renameOfCandidate(c)!]));
    for (const d of drafts) {
      const rn = byId.get(d.candidate_id)!;
      expect(renamePairs.has(`${rn.from}\u0000${rn.to}`)).toBe(true);
      expect(d.text.toLowerCase()).toContain(rn.from.toLowerCase());
      expect(d.text.toLowerCase()).toContain(rn.to.toLowerCase());
    }
    const lines = readDriftNarrative(v.result, cands);
    expect(lines?.length).toBe(drafts.length);
  });

  it('drops an invented rename and an unknown candidate (hostile recording)', () => {
    const rec = recordingByCase('drift-narrative-hostile-invented-rename');
    const v = task.validate(rec.recording.response.parsed, rec.request);
    expect(v.ok).toBe(true);
    if (!v.ok) return;
    expect((v.result.drafts ?? []).map((d) => d.candidate_id)).toEqual(['rn_02']);
    expect(v.dropped).toBe(2);
    expect(v.result.ext?.['dropped']).toBe(2);
    expect(JSON.stringify(v.result)).not.toContain('Interests');
  });

  it('readDriftNarrative: same rename rule, masked text, null on a malformed envelope', () => {
    const data = {
      v: 1,
      findings: [],
      drafts: [
        { candidate_id: 'rn_01', text: 'Units became Shares; wire to 021000021987654.' },
        { candidate_id: 'rn_01', text: 'Units became Shares again.' },
        { candidate_id: 'rn_02', text: 'Something else changed.' },
        { candidate_id: 'zz', text: 'Units became Shares.' },
      ],
    };
    const lines = readDriftNarrative(data, cands)!;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({ from: 'Units', to: 'Shares' });
    expect(lines[0]!.text).not.toMatch(/\d{5,}/);
    expect(readDriftNarrative({ nope: true }, cands)).toBeNull();
    expect(readDriftNarrative(null, cands)).toBeNull();
  });
});
