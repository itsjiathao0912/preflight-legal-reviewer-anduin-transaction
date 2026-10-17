/**
 * Casebook of LLM recordings (Phase 05, Stage 1c). Each case fixes one request (task, sample,
 * candidate selection, firm rules, response mode). Authored responses live in
 * `author-recordings.ts`; live runs (`record-ai.ts`) replace a case's file at the same path.
 */
import type { AiResponseMode, AiTaskId } from '@aduin/core';
import { pairCandidates, sampleCandidates, type RecordedRequest } from './ai-request';

export interface RecordingCase {
  id: string;
  task: AiTaskId;
  sample: string;
  /** Candidate ids to send; 'all' = every graph-selected candidate of the sample. */
  pick: 'all' | readonly string[];
  rule_texts: readonly string[];
  /** Cases that drive the precomputed sample files (one per bundled sample). */
  precompute?: boolean;
  /** Recorded live when a live run is allowed (F4). Hostile cases are authored only. */
  live?: boolean;
  /** Phase 07 drift-narrative: candidates come from the version diff of this [base, compare] pair. */
  pair?: readonly [string, string];
}

/** Active firm rule used by the rules-in-context case (synthetic; the demo seed rule is only proposed). */
export const IN_CONTEXT_RULE =
  'Placeholders for the investor name on the wire "FFC" line are firm standard wording.';

export const CASES: readonly RecordingCase[] = [
  {
    id: 'sample-01',
    task: 'clause-judgment',
    sample: '01',
    pick: 'all',
    rule_texts: [],
    precompute: true,
    live: true,
  },
  {
    id: 'sample-03',
    task: 'clause-judgment',
    sample: '03',
    pick: 'all',
    rule_texts: [],
    precompute: true,
    live: true,
  },
  {
    id: 'counsel-draft-03',
    task: 'counsel-draft',
    sample: '03',
    pick: ['c_fcfcb4a816686edb', 'c_54cd421d8bdba4af'],
    rule_texts: [],
    live: true,
  },
  {
    id: 'firm-rules-in-context-03',
    task: 'clause-judgment',
    sample: '03',
    pick: ['c_53ded8db41297f0a'],
    rule_texts: [IN_CONTEXT_RULE],
  },
  {
    id: 'hostile-hallucinated-quote',
    task: 'clause-judgment',
    sample: '01',
    pick: ['c_a3a1fd5641d412c0'],
    rule_texts: [],
  },
  {
    id: 'hostile-prose-around-json',
    task: 'clause-judgment',
    sample: '01',
    pick: ['c_439057b9bc027023'],
    rule_texts: [],
  },
  {
    id: 'hostile-extra-keys',
    task: 'clause-judgment',
    sample: '01',
    pick: ['c_777504f5f99ae768'],
    rule_texts: [],
  },
  {
    id: 'hostile-severity-critical',
    task: 'clause-judgment',
    sample: '01',
    pick: ['c_b30f291dff2535b6'],
    rule_texts: [],
  },
  {
    id: 'hostile-oversized-quote',
    task: 'clause-judgment',
    sample: '01',
    pick: ['c_624f0f476f804afb'],
    rule_texts: [],
  },
  // Phase 07 (07c): drift narrative over the #5 -> #6 version diff (public SEC samples)
  {
    id: 'drift-narrative-05-06',
    task: 'drift-narrative',
    sample: '05',
    pair: ['05', '06'],
    pick: 'all',
    rule_texts: [],
    live: true,
  },
  {
    id: 'drift-narrative-hostile-invented-rename',
    task: 'drift-narrative',
    sample: '05',
    pair: ['05', '06'],
    pick: ['rn_01', 'rn_02'],
    rule_texts: [],
  },
];

export function caseById(id: string): RecordingCase {
  const c = CASES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown case ${id}`);
  return c;
}

/** Concrete request for a case. Throws if a picked candidate id no longer exists (engine drift). */
export function caseRequest(
  c: RecordingCase,
  mode: AiResponseMode = 'json_schema',
): RecordedRequest {
  const candidates = c.pair
    ? pairCandidates(c.pair[0], c.pair[1])
    : sampleCandidates(c.sample).candidates;
  let picked = candidates;
  if (c.pick !== 'all') {
    picked = c.pick.map((id) => {
      const hit = candidates.find((x) => x.id === id);
      if (!hit) throw new Error(`case ${c.id}: candidate ${id} not produced by the engine`);
      return hit;
    });
  }
  return {
    task: c.task,
    // pair cases are not single-sample engine candidates (the core recorded check skips null)
    sample: c.pair ? null : c.sample,
    candidates: picked,
    rule_texts: [...c.rule_texts],
    mode,
    ...(c.pair ? { pair: [c.pair[0], c.pair[1]] as [string, string] } : {}),
  };
}
